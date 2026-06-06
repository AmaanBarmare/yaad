"""Vision service — item detection via Paytm Inference.

Uses Paytm Inference's OpenAI-compatible /v1/chat/completions endpoint with an
image_url content block (the path Paytm's own console documents, and the one
that actually serves vision today). The model is env-driven via VISION_MODEL.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Model id as recognised by the Paytm Inference gateway (see GET /v1/models).
MODEL = settings.VISION_MODEL

ITEM_DETECTION_PROMPT = """You are a kirana store assistant in India.
Look at this photo and return ONLY a valid JSON array.
Each object: {"name": "...", "quantity": 1, "category": "...", "reorder_days": 7}
Categories: dairy, bakery, staples, snacks, beverages, personal_care, household
Default reorder_days: dairy=7, bakery=5, staples=30, snacks=14, beverages=14,
personal_care=30, household=45
Only include clearly visible items. Common Indian grocery/FMCG only.
Return ONLY the JSON array, no other text."""


def _to_data_url(image_base64: str) -> str:
    """Return a data URL, accepting either raw base64 or an existing data URL."""
    if image_base64.startswith("data:"):
        return image_base64
    return f"data:image/jpeg;base64,{image_base64}"


def _parse_items(text: str) -> list[dict[str, Any]]:
    """Parse the model's text into a list of item dicts. Tolerates code fences
    and stray prose by extracting the first JSON array."""
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of items")
    return data


async def detect_items(image_base64: str) -> list[dict[str, Any]]:
    """Detect kirana items in a base64-encoded image.

    Returns a list of dicts: {name, quantity, category, reorder_days}.
    On any API or parse failure, logs the context and returns an empty list.
    """
    payload = {
        "model": MODEL,
        "max_tokens": 512,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": ITEM_DETECTION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": _to_data_url(image_base64)},
                    },
                ],
            }
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.PI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{settings.PI_BASE_URL}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
            raw_text = r.json()["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        logger.error("Paytm Inference vision call failed (model=%s): %s", MODEL, exc)
        return []

    try:
        items = _parse_items(raw_text)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error(
            "Failed to parse vision response as JSON (%s). Raw response: %s",
            exc,
            raw_text,
        )
        return []

    normalised: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict) or "name" not in it:
            continue
        normalised.append(
            {
                "name": str(it["name"]),
                "quantity": int(it.get("quantity", 1) or 1),
                "category": it.get("category"),
                "reorder_days": int(it.get("reorder_days", 7) or 7),
            }
        )
    return normalised
