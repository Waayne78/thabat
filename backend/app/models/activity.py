from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class ReviewSession(Base, TimestampMixin):
    __tablename__ = "review_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    mode: Mapped[str] = mapped_column(String(12), default="daily")  # daily | review | free
    day: Mapped[date] = mapped_column(Date, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    new_count: Mapped[int] = mapped_column(Integer, default=0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)


class Review(Base, TimestampMixin):
    """One rated recitation of one ayah (first learning or later review)."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ayah_id: Mapped[int] = mapped_column(ForeignKey("ayahs.id"), index=True)
    session_id: Mapped[int | None] = mapped_column(ForeignKey("review_sessions.id", ondelete="SET NULL"), default=None)
    day: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(8))  # learn | review
    rating: Mapped[str] = mapped_column(String(12))
    mistakes: Mapped[int] = mapped_column(Integer, default=0)
    mastery_before: Mapped[float] = mapped_column(Float)
    mastery_after: Mapped[float] = mapped_column(Float)
    interval_after: Mapped[int] = mapped_column(Integer)


class DailyProgress(Base, TimestampMixin):
    __tablename__ = "daily_progress"
    __table_args__ = (UniqueConstraint("user_id", "day", name="uq_daily_progress_user_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    target_new: Mapped[int] = mapped_column(Integer, default=0)
    new_learned: Mapped[int] = mapped_column(Integer, default=0)
    reviewed: Mapped[int] = mapped_column(Integer, default=0)
    seconds: Mapped[int] = mapped_column(Integer, default=0)
    mastery_avg: Mapped[float | None] = mapped_column(Float, default=None)  # snapshot of primary-goal progress
