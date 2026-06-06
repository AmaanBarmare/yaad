"""Yaad — FastAPI application entry point."""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import billing, customers, reminders
from scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Serverless platforms (Vercel) set this; APScheduler can't run there because
# there's no long-lived process. The on-demand reminder endpoint still works;
# the daily cron should be a Vercel Cron Job hitting an endpoint instead.
IS_SERVERLESS = bool(os.getenv("VERCEL"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Yaad backend")
    if not IS_SERVERLESS:
        try:
            start_scheduler()
        except Exception as exc:  # noqa: BLE001 — never block startup on the cron
            logger.error("Failed to start scheduler: %s", exc)
    yield
    if not IS_SERVERLESS:
        shutdown_scheduler()
    logger.info("Yaad backend stopped")


app = FastAPI(title="Yaad", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://localhost:5173"],
    # Allow any Vercel preview/production deployment of the frontend.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing.router)
app.include_router(reminders.router)
app.include_router(customers.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "yaad", "status": "ok"}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
