from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def today_in(tz_name: str | None) -> date:
    try:
        tz = ZoneInfo(tz_name or get_settings().default_timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()
