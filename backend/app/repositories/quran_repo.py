from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models import Ayah, Juz, Surah


def list_surahs(db: Session) -> list[Surah]:
    return list(db.scalars(select(Surah).order_by(Surah.id)))


def get_surah(db: Session, surah_id: int) -> Surah | None:
    return db.get(Surah, surah_id)


def list_juz(db: Session) -> list[Juz]:
    return list(db.scalars(select(Juz).order_by(Juz.id)))


def get_juz(db: Session, juz_id: int) -> Juz | None:
    return db.get(Juz, juz_id)


def get_ayah(db: Session, ayah_id: int) -> Ayah | None:
    return db.scalar(select(Ayah).options(joinedload(Ayah.surah)).where(Ayah.id == ayah_id))


def ayahs_by_ids(db: Session, ids: list[int]) -> list[Ayah]:
    if not ids:
        return []
    rows = db.scalars(select(Ayah).options(joinedload(Ayah.surah)).where(Ayah.id.in_(ids)))
    by_id = {a.id: a for a in rows}
    return [by_id[i] for i in ids if i in by_id]


def ayahs_of_surah(db: Session, surah_id: int) -> list[Ayah]:
    return list(db.scalars(select(Ayah).options(joinedload(Ayah.surah)).where(Ayah.surah_id == surah_id).order_by(Ayah.id)))


def surah_bounds(db: Session, first_id: int, last_id: int) -> list[Surah]:
    """Surahs overlapping the [first_id, last_id] global ayah range."""
    return list(
        db.scalars(
            select(Surah)
            .where(Surah.first_ayah_id <= last_id, Surah.first_ayah_id + Surah.ayah_count - 1 >= first_id)
            .order_by(Surah.id)
        )
    )
