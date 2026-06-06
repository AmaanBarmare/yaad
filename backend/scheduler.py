"""APScheduler — daily reminder cron.

Runs once a day, finds customers with overdue items, and generates a Hindi
message + voice note for each, persisting a reminder row. In the demo the
dashboard also triggers generation on-demand; this job makes the flow
automatic so it behaves like production.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import settings
from routes.reminders import _group_due
from services import sarvam, supabase_client

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def run_daily_reminders() -> None:
    """Generate reminders for every customer with overdue items."""
    logger.info("Daily reminder job started")
    try:
        rows = supabase_client.get_due_reminders()
    except Exception as exc:  # noqa: BLE001
        logger.error("Daily job could not query due reminders: %s", exc)
        return

    reminders = _group_due(rows)
    logger.info("Daily job: %d customers have overdue items", len(reminders))

    for reminder in reminders:
        cust = supabase_client.get_customer(reminder.customer_id)
        if not cust:
            continue
        language = cust.get("language", "hi")
        days = reminder.days_since_purchase or 7
        item_names = [i.name for i in reminder.items] or ["saamaan"]
        try:
            message_text = await sarvam.generate_message(
                customer_name=reminder.customer_name,
                items=item_names,
                days=days,
                language=language,
            )
            audio_base64 = await sarvam.generate_voice_note(
                message_text, language=language
            )
            filename = f"reminder-{reminder.customer_id}-{days}d.wav"
            audio_url = supabase_client.upload_audio(filename, audio_base64)
            supabase_client.save_reminder(
                customer_id=reminder.customer_id,
                message_text=message_text,
                audio_url=audio_url,
                status="ready",
            )
            logger.info("Daily reminder generated for %s", reminder.customer_name)
        except Exception as exc:  # noqa: BLE001
            logger.error(
                "Daily reminder failed for %s: %s", reminder.customer_name, exc
            )


def start_scheduler() -> AsyncIOScheduler:
    """Start the APScheduler instance (idempotent)."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        run_daily_reminders,
        trigger=CronTrigger(
            hour=settings.REMINDER_CRON_HOUR,
            minute=settings.REMINDER_CRON_MINUTE,
        ),
        id="daily_reminders",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — daily reminders at %02d:%02d",
        settings.REMINDER_CRON_HOUR,
        settings.REMINDER_CRON_MINUTE,
    )
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
