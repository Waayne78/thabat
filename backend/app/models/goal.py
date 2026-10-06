from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, SoftDeleteMixin, TimestampMixin


class Goal(Base, TimestampMixin, SoftDeleteMixin):
    """kind:
    - scope  : memorise a set of ayahs (juz / surahs / ranges, see GoalItem) before target_date
    - count  : learn `target_count` ayahs between start_date and target_date
    - daily  : learn `target_count` ayahs every day (recurring)
    - weekly : learn `target_count` ayahs every week (recurring)
    """

    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    kind: Mapped[str] = mapped_column(String(10), default="scope")
    start_date: Mapped[date] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date, default=None)
    target_count: Mapped[int | None] = mapped_column(Integer, default=None)
    daily_new: Mapped[int | None] = mapped_column(Integer, default=None)  # chosen pace (scope goals)
    # the plan is a straight line from (baseline_date, baseline_learned); re-anchored when pace or date change
    baseline_date: Mapped[date | None] = mapped_column(Date, default=None)
    baseline_learned: Mapped[int] = mapped_column(Integer, default=0)
    learning_order: Mapped[str] = mapped_column(String(16), default="short_first")  # short_first | mushaf
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(10), default="active")  # active | completed | archived

    items: Mapped[list["GoalItem"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan", order_by="GoalItem.position"
    )


class GoalItem(Base, TimestampMixin):
    __tablename__ = "goal_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_id: Mapped[int] = mapped_column(ForeignKey("goals.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    kind: Mapped[str] = mapped_column(String(10))  # juz | surah | range
    ref_id: Mapped[int | None] = mapped_column(Integer, default=None)  # juz or surah number
    first_ayah_id: Mapped[int] = mapped_column(Integer)
    last_ayah_id: Mapped[int] = mapped_column(Integer)

    goal: Mapped[Goal] = relationship(back_populates="items")
