"""Sober gamification: milestones that reflect real anchoring, never points for their own sake."""
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models import Achievement, Ayah, Juz, Memorization, Surah, User

ACHIEVEMENTS: list[dict] = [
    {"code": "first_verse", "icon": "sprout", "title": "Premier verset", "description": "Le premier verset appris. Tout commence ici."},
    {"code": "streak_3", "icon": "flame", "title": "3 jours de suite", "description": "Trois jours consécutifs de pratique."},
    {"code": "streak_7", "icon": "flame", "title": "Série de 7 jours", "description": "Une semaine entière sans interruption."},
    {"code": "streak_30", "icon": "moon", "title": "30 jours consécutifs", "description": "Un mois de constance."},
    {"code": "learned_50", "icon": "book", "title": "50 versets appris", "description": "Cinquante versets sont entrés en mémoire."},
    {"code": "first_surah", "icon": "bookmark", "title": "Première sourate", "description": "Une sourate entière apprise."},
    {"code": "mastered_100", "icon": "award", "title": "100 versets maîtrisés", "description": "Cent versets solidement ancrés."},
    {"code": "reviews_500", "icon": "repeat", "title": "500 révisions", "description": "La répétition est le secret de la mémoire."},
    {"code": "mastery_90", "icon": "star", "title": "90 % de maîtrise", "description": "Maîtrise moyenne de 90 % sur au moins 30 versets."},
    {"code": "first_juz", "icon": "book-open", "title": "Premier juz terminé", "description": "Un juz entier appris."},
]

LEVELS: list[tuple[int, str]] = [
    (0, "Débutant"), (20, "Régulier"), (80, "Assidu"), (250, "Mémorisateur"), (600, "Hafidh en progression"),
]


def level_for(points: float) -> dict:
    index = max(i for i, (threshold, _) in enumerate(LEVELS) if points >= threshold)
    floor, name = LEVELS[index]
    nxt = LEVELS[index + 1] if index + 1 < len(LEVELS) else None
    return {
        "level": index + 1, "name": name, "points": round(points, 1), "floor": floor,
        "next_threshold": nxt[0] if nxt else None, "next_name": nxt[1] if nxt else None,
        "progress_pct": round(100 * (points - floor) / (nxt[0] - floor), 1) if nxt else 100.0,
    }


def anchored_points(db: Session, user_id: int) -> float:
    """1 point = the equivalent of one fully mastered ayah."""
    total = db.scalar(select(func.coalesce(func.sum(Memorization.mastery), 0)).where(Memorization.user_id == user_id))
    return float(total or 0) / 100


def _facts(db: Session, user_id: int, current_streak: int, review_count: int) -> dict:
    base = select(func.count()).select_from(Memorization).where(Memorization.user_id == user_id)
    learned_filter = Memorization.first_learned_at.is_not(None)
    learned = db.scalar(base.where(learned_filter)) or 0
    mastered = db.scalar(base.where(Memorization.status == "mastered")) or 0
    avg = db.scalar(select(func.avg(Memorization.mastery)).where(Memorization.user_id == user_id, learned_filter)) or 0

    per_surah = dict(
        db.execute(
            select(Ayah.surah_id, func.count()).join(Memorization, Memorization.ayah_id == Ayah.id)
            .where(Memorization.user_id == user_id, learned_filter).group_by(Ayah.surah_id)
        ).all()
    )
    surah_done = bool(per_surah) and any(
        per_surah.get(s.id, 0) >= s.ayah_count for s in db.scalars(select(Surah).where(Surah.id.in_(per_surah.keys())))
    )
    per_juz = dict(
        db.execute(
            select(Ayah.juz_id, func.count()).join(Memorization, Memorization.ayah_id == Ayah.id)
            .where(Memorization.user_id == user_id, learned_filter).group_by(Ayah.juz_id)
        ).all()
    )
    juz_done = bool(per_juz) and any(
        per_juz.get(j.id, 0) >= j.ayah_count for j in db.scalars(select(Juz).where(Juz.id.in_(per_juz.keys())))
    )
    return {
        "first_verse": learned >= 1, "streak_3": current_streak >= 3, "streak_7": current_streak >= 7,
        "streak_30": current_streak >= 30, "learned_50": learned >= 50, "first_surah": surah_done,
        "mastered_100": mastered >= 100, "reviews_500": review_count >= 500,
        "mastery_90": learned >= 30 and avg >= 90, "first_juz": juz_done,
    }


def evaluate(db: Session, user: User, *, current_streak: int, review_count: int) -> list[dict]:
    """Unlocks newly reached milestones and returns them (caller commits)."""
    owned = set(db.scalars(select(Achievement.code).where(Achievement.user_id == user.id)))
    facts = _facts(db, user.id, current_streak, review_count)
    unlocked = []
    for a in ACHIEVEMENTS:
        if a["code"] not in owned and facts.get(a["code"]):
            db.add(Achievement(user_id=user.id, code=a["code"], unlocked_at=utcnow()))
            unlocked.append(a)
    return unlocked


def list_for(db: Session, user: User) -> dict:
    owned: dict[str, date] = {
        a.code: a.unlocked_at for a in db.scalars(select(Achievement).where(Achievement.user_id == user.id))
    }
    return {
        "level": level_for(anchored_points(db, user.id)),
        "levels": [{"level": i + 1, "name": n, "threshold": t} for i, (t, n) in enumerate(LEVELS)],
        "achievements": [
            {**a, "unlocked": a["code"] in owned, "unlocked_at": owned.get(a["code"])} for a in ACHIEVEMENTS
        ],
    }
