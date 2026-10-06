from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Ayah, Memorization


def get(db: Session, user_id: int, ayah_id: int) -> Memorization | None:
    return db.scalar(select(Memorization).where(Memorization.user_id == user_id, Memorization.ayah_id == ayah_id))


def all_for_user(db: Session, user_id: int) -> list[Memorization]:
    return list(db.scalars(select(Memorization).where(Memorization.user_id == user_id)))


def due(db: Session, user_id: int, today: date) -> list[Memorization]:
    return list(
        db.scalars(
            select(Memorization)
            .options(joinedload(Memorization.ayah).joinedload(Ayah.surah))
            .where(Memorization.user_id == user_id, Memorization.due_date <= today)
        )
    )


def recently_mastered(db: Session, user_id: int, limit: int = 5) -> list[Memorization]:
    return list(
        db.scalars(
            select(Memorization)
            .options(joinedload(Memorization.ayah).joinedload(Ayah.surah))
            .where(Memorization.user_id == user_id, Memorization.status == "mastered")
            .order_by(Memorization.mastered_at.desc())
            .limit(limit)
        )
    )


def count_learned(db: Session, user_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(Memorization)
        .where(Memorization.user_id == user_id, Memorization.first_learned_at.is_not(None))
    ) or 0
