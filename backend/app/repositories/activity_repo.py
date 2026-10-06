from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DailyProgress, Review, ReviewSession


def get_day(db: Session, user_id: int, day: date) -> DailyProgress | None:
    return db.scalar(select(DailyProgress).where(DailyProgress.user_id == user_id, DailyProgress.day == day))


def days_between(db: Session, user_id: int, start: date, end: date) -> list[DailyProgress]:
    return list(
        db.scalars(
            select(DailyProgress)
            .where(DailyProgress.user_id == user_id, DailyProgress.day >= start, DailyProgress.day <= end)
            .order_by(DailyProgress.day)
        )
    )


def all_days(db: Session, user_id: int) -> list[DailyProgress]:
    return list(db.scalars(select(DailyProgress).where(DailyProgress.user_id == user_id).order_by(DailyProgress.day)))


def get_session(db: Session, user_id: int, session_id: int) -> ReviewSession | None:
    return db.scalar(select(ReviewSession).where(ReviewSession.id == session_id, ReviewSession.user_id == user_id))


def reviewed_ayah_ids_on(db: Session, user_id: int, day: date) -> set[int]:
    return set(db.scalars(select(Review.ayah_id).where(Review.user_id == user_id, Review.day == day)))


def count_reviews(db: Session, user_id: int, kind: str | None = None) -> int:
    q = select(func.count()).select_from(Review).where(Review.user_id == user_id)
    if kind:
        q = q.where(Review.kind == kind)
    return db.scalar(q) or 0


def learned_between(db: Session, user_id: int, start: date, end: date) -> int:
    return db.scalar(
        select(func.coalesce(func.sum(DailyProgress.new_learned), 0))
        .where(DailyProgress.user_id == user_id, DailyProgress.day >= start, DailyProgress.day <= end)
    ) or 0
