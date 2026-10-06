from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin
from app.models.quran import Ayah


class Memorization(Base, TimestampMixin):
    """Per-user state of one ayah: mastery score + spaced-repetition scheduling."""

    __tablename__ = "memorizations"
    __table_args__ = (UniqueConstraint("user_id", "ayah_id", name="uq_memorization_user_ayah"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    ayah_id: Mapped[int] = mapped_column(ForeignKey("ayahs.id"), index=True)
    status: Mapped[str] = mapped_column(String(12), default="in_progress")  # in_progress | learned | mastered
    mastery: Mapped[float] = mapped_column(Float, default=0.0)  # 0..100
    ease: Mapped[float] = mapped_column(Float, default=2.3)
    interval_days: Mapped[int] = mapped_column(Integer, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    lapses: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    learned_day: Mapped[date | None] = mapped_column(Date, default=None)
    first_learned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    mastered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    ayah: Mapped[Ayah] = relationship()
