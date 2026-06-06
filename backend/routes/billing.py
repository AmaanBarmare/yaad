"""Flow 1 — billing: payment → photo → item detection → DB."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from models import (
    ConfirmRequest,
    ConfirmResponse,
    DetectItemsRequest,
    DetectItemsResponse,
    DetectedItem,
    ItemOut,
    SimulatePaymentResponse,
)
from services import sarvam, supabase_client, vision

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

# Cache the Bulbul-generated soundbox clip so we synthesise it only once.
_SOUNDBOX_PHRASE = "दो सौ रुपये प्राप्त हुए। पेटीएम।"
_soundbox_audio_cache: str | None = None


@router.post("/simulate-payment", response_model=SimulatePaymentResponse)
async def simulate_payment() -> SimulatePaymentResponse:
    """Simulate the Paytm soundbox firing on a ₹200 payment.

    Returns Bulbul-generated audio ("Do sau rupaye prapt hue") so the frontend
    can play the soundbox sound, then prompt the merchant to log items.
    """
    global _soundbox_audio_cache
    logger.info("Soundbox simulated: ₹200 received — prompting merchant to log items")

    if _soundbox_audio_cache is None:
        try:
            _soundbox_audio_cache = await sarvam.generate_voice_note(
                _SOUNDBOX_PHRASE, language="hi-IN"
            )
        except Exception as exc:  # noqa: BLE001 — soundbox audio is best-effort
            logger.error("Soundbox TTS failed: %s", exc)

    return SimulatePaymentResponse(
        amount=200.0,
        audio_clip_url=None,
        audio_base64=_soundbox_audio_cache,
        message="₹200 received — tap to log items",
    )


@router.post("/detect-items", response_model=DetectItemsResponse)
async def detect_items(req: DetectItemsRequest) -> DetectItemsResponse:
    """Run Claude Sonnet 4.6 over the uploaded photo and return detected items."""
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    raw_items = await vision.detect_items(req.image_base64)
    items = [DetectedItem(**it) for it in raw_items]
    logger.info("Detected %d items from photo", len(items))
    return DetectItemsResponse(items=items)


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm(req: ConfirmRequest) -> ConfirmResponse:
    """Persist the transaction + items, computing reorder_due_at per item."""
    if not req.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    try:
        txn = supabase_client.create_transaction(req.customer_id, req.amount)
        txn_id = txn["id"]

        now = datetime.now(timezone.utc)
        item_rows = []
        for it in req.items:
            due_at = now + timedelta(days=it.reorder_days)
            item_rows.append(
                {
                    "name": it.name,
                    "quantity": it.quantity,
                    "category": it.category,
                    "reorder_days": it.reorder_days,
                    "reorder_due_at": due_at,
                }
            )
        saved = supabase_client.create_items(txn_id, item_rows)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to confirm transaction: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to save transaction") from exc

    items_out = [
        ItemOut(
            id=row["id"],
            name=row["name"],
            quantity=row.get("quantity", 1),
            category=row.get("category"),
            reorder_days=row.get("reorder_days", 7),
            reorder_due_at=row.get("reorder_due_at"),
        )
        for row in saved
    ]
    logger.info("Confirmed transaction %s with %d items", txn_id, len(items_out))
    return ConfirmResponse(
        transaction_id=txn_id, customer_id=req.customer_id, items=items_out
    )
