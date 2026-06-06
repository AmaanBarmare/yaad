"""Customer CRUD + purchase history."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException

from models import (
    CreateCustomerRequest,
    CustomerDetail,
    CustomerSummary,
    ItemOut,
    PurchaseHistoryItem,
)
from services import supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/customers", tags=["customers"])


def _parse_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _risk_for_items(items: list[dict[str, Any]], now: datetime) -> str:
    """Worst-case risk across a customer's items: overdue > due_soon > ok."""
    risk = "ok"
    for it in items:
        due = _parse_dt(it.get("reorder_due_at"))
        if not due:
            continue
        delta_days = (due - now).total_seconds() / 86400
        if delta_days <= 0:
            return "overdue"
        if delta_days <= 2:
            risk = "due_soon"
    return risk


@router.get("", response_model=list[CustomerSummary])
async def list_customers() -> list[CustomerSummary]:
    """List all customers with latest transaction date, recent items, risk."""
    try:
        customers = supabase_client.get_customers()
        now = datetime.now(timezone.utc)
        summaries: list[CustomerSummary] = []

        for cust in customers:
            txns = supabase_client.get_transactions_for_customer(cust["id"])
            txn_ids = [t["id"] for t in txns]
            items = supabase_client.get_items_for_transactions(txn_ids)

            last_purchase = txns[0]["created_at"] if txns else None
            # Items belonging to the most recent transaction, for the preview.
            recent_txn_id = txns[0]["id"] if txns else None
            recent_items = [
                it["name"] for it in items if it.get("transaction_id") == recent_txn_id
            ]

            summaries.append(
                CustomerSummary(
                    id=cust["id"],
                    name=cust["name"],
                    phone=cust.get("phone"),
                    language=cust.get("language", "hi"),
                    last_purchase_at=_parse_dt(last_purchase),
                    recent_items=recent_items,
                    risk=_risk_for_items(items, now),
                )
            )
        return summaries
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to list customers: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to load customers") from exc


@router.post("", response_model=CustomerSummary, status_code=201)
async def create_customer(req: CreateCustomerRequest) -> CustomerSummary:
    try:
        cust = supabase_client.create_customer(req.name, req.phone, req.language)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to create customer: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to create customer") from exc
    return CustomerSummary(
        id=cust["id"],
        name=cust["name"],
        phone=cust.get("phone"),
        language=cust.get("language", "hi"),
    )


@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(customer_id: str) -> CustomerDetail:
    """Customer detail with full purchase history."""
    cust = supabase_client.get_customer(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    try:
        txns = supabase_client.get_transactions_for_customer(customer_id)
        txn_ids = [t["id"] for t in txns]
        all_items = supabase_client.get_items_for_transactions(txn_ids)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load history for %s: %s", customer_id, exc)
        raise HTTPException(status_code=502, detail="Failed to load history") from exc

    items_by_txn: dict[str, list[dict[str, Any]]] = {}
    for it in all_items:
        items_by_txn.setdefault(it["transaction_id"], []).append(it)

    history: list[PurchaseHistoryItem] = []
    for txn in txns:
        rows = items_by_txn.get(txn["id"], [])
        history.append(
            PurchaseHistoryItem(
                transaction_id=txn["id"],
                amount=txn.get("amount"),
                purchased_at=_parse_dt(txn.get("created_at")),
                items=[
                    ItemOut(
                        id=r["id"],
                        name=r["name"],
                        quantity=r.get("quantity", 1),
                        category=r.get("category"),
                        reorder_days=r.get("reorder_days", 7),
                        reorder_due_at=_parse_dt(r.get("reorder_due_at")),
                    )
                    for r in rows
                ],
            )
        )

    return CustomerDetail(
        id=cust["id"],
        name=cust["name"],
        phone=cust.get("phone"),
        language=cust.get("language", "hi"),
        created_at=_parse_dt(cust.get("created_at")),
        history=history,
    )
