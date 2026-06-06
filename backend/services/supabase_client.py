"""Thin wrapper around supabase-py for all DB + Storage operations.

The client is created lazily so the app can boot (and serve docs) even when
Supabase credentials are not yet configured.
"""
from __future__ import annotations

import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from supabase import Client, create_client

from config import settings

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_client() -> Client:
    """Return a cached service-role Supabase client."""
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "Supabase is not configured — set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY in your .env"
            )
        _client = create_client(
            settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return _client


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
def get_customers() -> list[dict[str, Any]]:
    res = get_client().table("customers").select("*").order("created_at").execute()
    return res.data or []


def get_customer(customer_id: str) -> Optional[dict[str, Any]]:
    res = (
        get_client()
        .table("customers")
        .select("*")
        .eq("id", customer_id)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def create_customer(name: str, phone: Optional[str], language: str = "hi") -> dict[str, Any]:
    res = (
        get_client()
        .table("customers")
        .insert({"name": name, "phone": phone, "language": language})
        .execute()
    )
    return (res.data or [{}])[0]


# ---------------------------------------------------------------------------
# Transactions + items
# ---------------------------------------------------------------------------
def create_transaction(customer_id: str, amount: float) -> dict[str, Any]:
    res = (
        get_client()
        .table("transactions")
        .insert({"customer_id": customer_id, "amount": amount})
        .execute()
    )
    return (res.data or [{}])[0]


def create_items(transaction_id: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Insert items for a transaction.

    Each item dict may carry name/quantity/category/reorder_days. If
    ``reorder_due_at`` is absent it is computed from now + reorder_days.
    """
    now = datetime.now(timezone.utc)
    rows: list[dict[str, Any]] = []
    for it in items:
        reorder_days = int(it.get("reorder_days") or 7)
        due_at = it.get("reorder_due_at") or (now + timedelta(days=reorder_days))
        if isinstance(due_at, datetime):
            due_at = due_at.isoformat()
        rows.append(
            {
                "transaction_id": transaction_id,
                "name": it["name"],
                "quantity": int(it.get("quantity") or 1),
                "category": it.get("category"),
                "reorder_days": reorder_days,
                "reorder_due_at": due_at,
            }
        )
    res = get_client().table("items").insert(rows).execute()
    return res.data or []


def get_transactions_for_customer(customer_id: str) -> list[dict[str, Any]]:
    res = (
        get_client()
        .table("transactions")
        .select("*")
        .eq("customer_id", customer_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def get_items_for_transactions(transaction_ids: list[str]) -> list[dict[str, Any]]:
    if not transaction_ids:
        return []
    res = (
        get_client()
        .table("items")
        .select("*")
        .in_("transaction_id", transaction_ids)
        .execute()
    )
    return res.data or []


# ---------------------------------------------------------------------------
# Reminders / due query
# ---------------------------------------------------------------------------
def get_due_reminders() -> list[dict[str, Any]]:
    """Return items whose reorder_due_at is at or before now, joined to their
    transaction's customer. Uses a PostgREST embedded select."""
    now = datetime.now(timezone.utc).isoformat()
    res = (
        get_client()
        .table("items")
        .select(
            "id, name, quantity, category, reorder_due_at, "
            "transactions!inner(id, created_at, customer_id, "
            "customers!inner(id, name))"
        )
        .lte("reorder_due_at", now)
        .order("reorder_due_at")
        .execute()
    )
    return res.data or []


def save_reminder(
    customer_id: str,
    message_text: str,
    audio_url: Optional[str],
    status: str = "ready",
) -> dict[str, Any]:
    res = (
        get_client()
        .table("reminders")
        .insert(
            {
                "customer_id": customer_id,
                "message_text": message_text,
                "audio_url": audio_url,
                "status": status,
            }
        )
        .execute()
    )
    return (res.data or [{}])[0]


def get_reminders() -> list[dict[str, Any]]:
    res = (
        get_client()
        .table("reminders")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
def upload_audio(filename: str, audio_base64: str) -> Optional[str]:
    """Upload base64 audio to the storage bucket and return a public URL.

    Returns None (and logs) on failure so callers can fall back to inline
    base64 audio for the demo.
    """
    try:
        client = get_client()
        bucket = settings.SUPABASE_AUDIO_BUCKET
        raw = base64.b64decode(audio_base64)
        client.storage.from_(bucket).upload(
            path=filename,
            file=raw,
            file_options={"content-type": "audio/wav", "upsert": "true"},
        )
        return client.storage.from_(bucket).get_public_url(filename)
    except Exception as exc:  # noqa: BLE001 — best-effort for demo
        logger.warning("Audio upload to Supabase Storage failed: %s", exc)
        return None
