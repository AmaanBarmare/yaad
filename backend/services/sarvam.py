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
    prompt = f"""Write a warm Hindi WhatsApp reminder from a kirana shopkeeper.
Customer: {customer_name}
Items bought {days} days ago: {', '.join(items)}
Under 30 words. Sound local, not corporate.
Return ONLY the message."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                CHAT_URL,
                headers={"Authorization": f"Bearer {settings.SARVAM_API_KEY}"},
                json={
                    "model": "sarvam-30b",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:  # noqa: BLE001
        logger.error("Sarvam message generation failed: %s", exc)
        raise


async def generate_voice_note(text: str, language: str = "hi-IN") -> str:
    """Synthesise a Hindi voice note via Bulbul V3. Returns base64 audio."""
    target_language_code = _normalise_lang(language)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
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
