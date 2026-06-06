"""Application settings loaded from environment / .env via pydantic-settings."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Paytm Inference — Claude Sonnet 4.6 (vision)
    PI_API_KEY: str = ""
    PI_BASE_URL: str = "https://api.inference.paytm.com"
    # Vision model id as recognised by the Paytm Inference gateway.
    # Target is "Claude Opus 4.5", but that currently 422s upstream (no Bedrock
    # inference profile); llama-4-scout is the working vision model today.
    VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # Sarvam AI
    SARVAM_API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_AUDIO_BUCKET: str = "voice-notes"

    # Scheduler
    REMINDER_CRON_HOUR: int = 10
    REMINDER_CRON_MINUTE: int = 0

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        # Load from repo-root .env regardless of where uvicorn is launched.
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
