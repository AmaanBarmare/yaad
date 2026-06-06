"""Vercel Python entry point for the Yaad FastAPI backend.

Vercel's Python runtime serves the module-level ASGI ``app``. The backend code
lives in ../backend, so we add it to the import path before importing.
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402  (import after sys.path tweak)

# Vercel detects and serves this ASGI application.
__all__ = ["app"]
