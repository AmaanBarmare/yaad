"""Sarvam service — message generation (Sarvam 30B) + Bulbul V3 TTS."""
from __future__ import annotations

import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
TTS_URL = "https://api.sarvam.ai/text-to-speech"

_LANG_MAP = {
    "hi": "hi-IN",
    "en": "en-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
}


def _normalise_lang(language: str) -> str:
    """Map a short language code (e.g. 'hi') to a Sarvam locale (e.g. 'hi-IN')."""
    if "-" in language:
        return language
    return _LANG_MAP.get(language, "hi-IN")


async def generate_message(
    customer_name: str,
    items: list[str],
    days: int,
    language: str = "hi",
) -> str:
    """Generate a warm Hindi WhatsApp reminder via Sarvam 30B."""
    items_str = ", ".join(items)
    prompt = f"""You are a friendly neighbourhood kirana (grocery) shopkeeper in India \
writing a short WhatsApp reorder reminder to a regular customer.

Customer: {customer_name}
Items they bought about {days} days ago and are probably running low on: {items_str}

Write ONE warm, casual message in Hindi (Hinglish/Roman Hindi is fine) that:
- greets {customer_name} by name
- explicitly names the item(s): {items_str}
- gently says these are probably finishing and invites them to reorder / drop by

Hard rules: under 25 words, local and personal (not corporate), and it MUST mention \
the item name(s) above. Return ONLY the message text — no quotes, no explanation, no preamble."""

    payload = {
        "model": "sarvam-30b",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.6,
        # sarvam-30b is a reasoning model: its "thinking" consumes completion
        # tokens before the answer. Give it enough room so `content` isn't
        # truncated to null (finish_reason=length).
        "max_tokens": 4000,
    }

    try:
        # Reasoning can be slow; allow generous time. Retry once if the model
        # uses all its budget thinking and returns empty content.
        async with httpx.AsyncClient(timeout=120.0) as client:
            for attempt in range(2):
                r = await client.post(
                    CHAT_URL,
                    headers={"Authorization": f"Bearer {settings.SARVAM_API_KEY}"},
                    json=payload,
                )
                r.raise_for_status()
                msg = r.json()["choices"][0]["message"]
                content = (msg.get("content") or "").strip()
                if content:
                    return content
                logger.warning(
                    "Sarvam returned empty content (attempt %d); retrying", attempt + 1
                )
        raise ValueError("Sarvam returned an empty message after retry")
    except Exception as exc:  # noqa: BLE001
        logger.error("Sarvam message generation failed: %s", exc)
        raise


async def generate_voice_note(text: str, language: str = "hi-IN") -> str:
    """Synthesise a Hindi voice note via Bulbul V3. Returns base64 audio."""
    target_language_code = _normalise_lang(language)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                TTS_URL,
                headers={"api-subscription-key": settings.SARVAM_API_KEY},
                json={
                    "inputs": [text],
                    "target_language_code": target_language_code,
                    # bulbul:v3 female Hindi voice (meera from the brief is v2-only)
                    "speaker": "ritu",
                    "model": "bulbul:v3",
                },
            )
            r.raise_for_status()
            return r.json()["audios"][0]
    except Exception as exc:  # noqa: BLE001
        logger.error("Bulbul V3 TTS failed: %s", exc)
        raise
