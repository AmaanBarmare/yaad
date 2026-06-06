"""Seed the Yaad database with demo customers and purchase histories.

Run from the repo root:  python scripts/seed.py
(or from backend/:        python ../scripts/seed.py)

Produces a dashboard with a clear spread of reorder risk so the reminder
flow is immediately demoable:

  Priya Sharma  — Eggs, Bread        13 days ago   overdue   (dairy/bakery)
  Anita Patel   — Atta, Toor Dal     33 days ago   overdue   (staples)
  Rajesh Kumar  — Milk, Dahi          6 days ago   due soon  (dairy)
  Suresh Mehta  — Maggi, Parle-G     11 days ago   ok        (snacks)

Two customers (Priya, Anita) have items past reorder_due_at on first load.

Note on ages: the brief lists Anita at ~28 days, but with the staples
reorder window of 30 days that would not yet be overdue. She is seeded at
33 days so that the brief's "at least 2 customers overdue" requirement
actually holds.
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timedelta, timezone

# Make the backend package importable regardless of where this is launched.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_REPO_ROOT, "backend"))

from services.supabase_client import get_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed")

# reorder windows by category (mirrors vision prompt defaults)
CATEGORY_DAYS = {
    "dairy": 7,
    "bakery": 5,
    "staples": 30,
    "snacks": 14,
    "beverages": 14,
    "personal_care": 30,
    "household": 45,
}

# (name, phone, language, amount, days_ago, [ (item, qty, category), ... ])
SEED = [
    (
        "Priya Sharma",
        "+91 98200 11111",
        "hi",
        180.0,
        13,
        [("Eggs", 12, "dairy"), ("Bread", 1, "bakery")],
    ),
    (
        "Anita Patel",
        "+91 98200 22222",
        "hi",
        540.0,
        33,
        [("Atta", 1, "staples"), ("Toor Dal", 1, "staples")],
    ),
    (
        "Rajesh Kumar",
        "+91 98200 33333",
        "hi",
        95.0,
        6,
        [("Milk", 2, "dairy"), ("Dahi", 1, "dairy")],
    ),
    (
        "Suresh Mehta",
        "+91 98200 44444",
        "hi",
        70.0,
        11,
        [("Maggi", 4, "snacks"), ("Parle-G", 3, "snacks")],
    ),
]


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def main() -> None:
    client = get_client()
    now = datetime.now(timezone.utc)

    names = [row[0] for row in SEED]

    # Re-runnable: delete existing demo customers (cascades to txns/items/reminders).
    logger.info("Clearing existing demo customers: %s", ", ".join(names))
    client.table("customers").delete().in_("name", names).execute()

    for name, phone, language, amount, days_ago, items in SEED:
        purchased_at = now - timedelta(days=days_ago)

        cust = (
            client.table("customers")
            .insert({"name": name, "phone": phone, "language": language})
            .execute()
            .data[0]
        )
        customer_id = cust["id"]

        txn = (
            client.table("transactions")
            .insert(
                {
                    "customer_id": customer_id,
                    "amount": amount,
                    "created_at": _iso(purchased_at),
                }
            )
            .execute()
            .data[0]
        )
        txn_id = txn["id"]

        item_rows = []
        for item_name, qty, category in items:
            reorder_days = CATEGORY_DAYS.get(category, 7)
            due_at = purchased_at + timedelta(days=reorder_days)
            item_rows.append(
                {
                    "transaction_id": txn_id,
                    "name": item_name,
                    "quantity": qty,
                    "category": category,
                    "reorder_days": reorder_days,
                    "reorder_due_at": _iso(due_at),
                    "created_at": _iso(purchased_at),
                }
            )
        client.table("items").insert(item_rows).execute()

        overdue = any(
            (purchased_at + timedelta(days=CATEGORY_DAYS.get(c, 7))) <= now
            for _, _, c in items
        )
        logger.info(
            "Seeded %-14s %-22s %2dd ago  %s",
            name,
            ", ".join(i[0] for i in items),
            days_ago,
            "OVERDUE" if overdue else "ok",
        )

    logger.info("Seed complete — %d customers", len(SEED))


if __name__ == "__main__":
    main()
