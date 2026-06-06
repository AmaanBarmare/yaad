"""Flow 2 — reminders: due query, message + voice note generation, history."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import DueItem, DueReminder, ReminderOut
from services import sarvam, supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reminders", tags=["reminders"])


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _group_due(rows: list[dict[str, Any]]) -> list[DueReminder]:
    """Group the flat due-items query into per-customer reminders."""
    now = datetime.now(timezone.utc)
    by_customer: dict[str, DueReminder] = {}

    for row in rows:
        txn = row.get("transactions") or {}
        cust = txn.get("customers") or {}
        cust_id = cust.get("id")
        if not cust_id:
            continue

        if cust_id not in by_customer:
            purchased_at = _parse_dt(txn.get("created_at"))
            days = None
            if purchased_at:
                days = max(0, (now - purchased_at).days)
            by_customer[cust_id] = DueReminder(
                customer_id=cust_id,
                customer_name=cust.get("name", "Customer"),
                days_since_purchase=days,
                items=[],
            )

        by_customer[cust_id].items.append(
            DueItem(
                item_id=row["id"],
                name=row["name"],
                quantity=row.get("quantity", 1),
                category=row.get("category"),
                reorder_due_at=_parse_dt(row.get("reorder_due_at")),
            )
        )

    return list(by_customer.values())


@router.get("/due", response_model=list[DueReminder])
async def due_reminders() -> list[DueReminder]:
    """Customers with one or more items past their reorder_due_at."""
    try:
        rows = supabase_client.get_due_reminders()
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to query due reminders: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to query due items") from exc
    return _group_due(rows)


def _find_due_for_customer(customer_id: str) -> Optional[DueReminder]:
    rows = supabase_client.get_due_reminders()
    for reminder in _group_due(rows):
        if reminder.customer_id == customer_id:
            return reminder
    return None


@router.post("/generate/{customer_id}")
async def generate_reminder(customer_id: str) -> StreamingResponse:
    """Generate a Hindi message + voice note, streaming progress via SSE.

    Streams three events: generating_message → synthesising_audio → ready.
    """
    cust = supabase_client.get_customer(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    due = _find_due_for_customer(customer_id)
    item_names = [i.name for i in due.items] if due else []
    days = due.days_since_purchase if (due and due.days_since_purchase) else 7
    language = cust.get("language", "hi")

    async def event_stream():
        def sse(event: str, data: dict[str, Any]) -> str:
            return f"event: {event}\ndata: {json.dumps(data)}\n\n"

        try:
            yield sse("generating_message", {"status": "generating_message"})
            message_text = await sarvam.generate_message(
                customer_name=cust["name"],
                items=item_names or ["saamaan"],
                days=days,
                language=language,
            )

            yield sse(
                "synthesising_audio",
                {"status": "synthesising_audio", "message_text": message_text},
            )
            audio_base64 = await sarvam.generate_voice_note(
                message_text, language=language
            )

            filename = f"reminder-{customer_id}-{days}d.wav"
            audio_url = supabase_client.upload_audio(filename, audio_base64)

            supabase_client.save_reminder(
                customer_id=customer_id,
                message_text=message_text,
                audio_url=audio_url,
                status="ready",
            )

            yield sse(
                "ready",
                {
                    "status": "ready",
                    "message_text": message_text,
                    "audio_url": audio_url,
                    "audio_base64": audio_base64,
                },
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("Reminder generation failed for %s: %s", customer_id, exc)
            yield sse("error", {"status": "error", "detail": str(exc)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/history", response_model=list[ReminderOut])
async def reminder_history() -> list[ReminderOut]:
    """All generated reminders, newest first."""
    try:
        rows = supabase_client.get_reminders()
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load reminder history: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to load history") from exc
    return [
        ReminderOut(
            id=r["id"],
            customer_id=r["customer_id"],
            message_text=r.get("message_text"),
            audio_url=r.get("audio_url"),
            status=r.get("status", "pending"),
            created_at=_parse_dt(r.get("created_at")),
        )
        for r in rows
    ]
