import datetime as dt
from typing import Literal

from pydantic import BaseModel, Field

from app.services.srs import Rating


class SessionIn(BaseModel):
    mode: Literal["daily", "review", "free"] = "daily"


class SessionFinishIn(BaseModel):
    duration_seconds: int = Field(ge=0, le=6 * 3600)


class RecordIn(BaseModel):
    ayah_id: int = Field(ge=1, le=6236)
    rating: Rating
    mistakes: int = Field(default=0, ge=0, le=200)
    session_id: int | None = None


class ReminderIn(BaseModel):
    kind: Literal["session", "review", "deadline", "encouragement"] = "session"
    time: dt.time
    days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6], max_length=7)
    frequency: Literal["daily", "if_pending", "weekly"] = "daily"
    enabled: bool = True


class ReminderPatch(BaseModel):
    kind: Literal["session", "review", "deadline", "encouragement"] | None = None
    time: dt.time | None = None
    days: list[int] | None = Field(default=None, max_length=7)
    frequency: Literal["daily", "if_pending", "weekly"] | None = None
    enabled: bool | None = None


class KnownIn(BaseModel):
    """Ayahs the user already knows before starting (they still get verified by spaced reviews)."""

    ayah_ids: list[int] = Field(min_length=1, max_length=6236)
    level: Literal["solid", "approximate"] = "solid"
