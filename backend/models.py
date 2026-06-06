"""Pydantic request/response models for the Yaad API."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Items / detection
# ---------------------------------------------------------------------------
class DetectedItem(BaseModel):
    name: str
    quantity: int = 1
    category: Optional[str] = None
    reorder_days: int = 7


class DetectItemsRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded JPEG/PNG of the items")
    txn_id: Optional[str] = None


class DetectItemsResponse(BaseModel):
    items: list[DetectedItem]


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class SimulatePaymentResponse(BaseModel):
    txn_id: Optional[str] = None
    amount: float = 200.0
    audio_clip_url: Optional[str] = None
    message: str = "Payment received"


class ConfirmRequest(BaseModel):
    customer_id: str
    amount: float = 0.0
    items: list[DetectedItem]


class ItemOut(DetectedItem):
    id: str
    reorder_due_at: Optional[datetime] = None


class ConfirmResponse(BaseModel):
    transaction_id: str
    customer_id: str
    items: list[ItemOut]


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
class CustomerSummary(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    language: str = "hi"
    last_purchase_at: Optional[datetime] = None
    recent_items: list[str] = Field(default_factory=list)
    risk: str = "ok"  # ok | due_soon | overdue


class PurchaseHistoryItem(BaseModel):
    transaction_id: str
    amount: Optional[float] = None
    purchased_at: Optional[datetime] = None
    items: list[ItemOut] = Field(default_factory=list)


class CustomerDetail(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    language: str = "hi"
    created_at: Optional[datetime] = None
    history: list[PurchaseHistoryItem] = Field(default_factory=list)


class CreateCustomerRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    language: str = "hi"


# ---------------------------------------------------------------------------
# Reminders
# ---------------------------------------------------------------------------
class DueItem(BaseModel):
    item_id: str
    name: str
    quantity: int = 1
    category: Optional[str] = None
    reorder_due_at: Optional[datetime] = None


class DueReminder(BaseModel):
    customer_id: str
    customer_name: str
    days_since_purchase: Optional[int] = None
    items: list[DueItem] = Field(default_factory=list)


class ReminderOut(BaseModel):
    id: str
    customer_id: str
    message_text: Optional[str] = None
    audio_url: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None


class GenerateReminderResponse(BaseModel):
    message_text: str
    audio_url: Optional[str] = None
    audio_base64: Optional[str] = None
