from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Memorization, User
from app.repositories import activity_repo
from app.services import gamification, progress_service


def statistics(db: Session, user: User, day: date) -> dict:
    rows = activity_repo.all_days(db, user.id)
    by_day = {r.day: r for r in rows}
    base = select(func.count()).select_from(Memorization).where(Memorization.user_id == user.id)
    learned_filter = Memorization.first_learned_at.is_not(None)
    learned = db.scalar(base.where(learned_filter)) or 0
    mastered = db.scalar(base.where(Memorization.status == "mastered")) or 0
    avg_mastery = db.scalar(
        select(func.avg(Memorization.mastery)).where(Memorization.user_id == user.id, learned_filter)
    ) or 0

    best = max(rows, key=lambda r: r.new_learned + r.reviewed, default=None)
    first_day = rows[0].day if rows else day
    span = max(1, (day - first_day).days + 1)
    total_new = sum(r.new_learned for r in rows)

    daily = []
    last_mastery: float | None = None
    for r in rows:
        if r.day < day - timedelta(days=29) and r.mastery_avg is not None:
            last_mastery = r.mastery_avg
    for offset in range(29, -1, -1):
        d = day - timedelta(days=offset)
        r = by_day.get(d)
        if r and r.mastery_avg is not None:
            last_mastery = r.mastery_avg
        daily.append({
            "date": d, "new": r.new_learned if r else 0, "reviewed": r.reviewed if r else 0,
            "seconds": r.seconds if r else 0, "mastery": last_mastery,
        })

    monday = day - timedelta(days=day.weekday())
    weekly = []
    for w in range(7, -1, -1):
        start = monday - timedelta(weeks=w)
        chunk = [by_day[start + timedelta(days=i)] for i in range(7) if start + timedelta(days=i) in by_day]
        weekly.append({
            "week_start": start, "new": sum(r.new_learned for r in chunk),
            "reviewed": sum(r.reviewed for r in chunk), "seconds": sum(r.seconds for r in chunk),
        })

    buckets = [0, 0, 0, 0, 0]  # 0-19, 20-39, 40-59, 60-79, 80-100
    for (m,) in db.execute(select(Memorization.mastery).where(Memorization.user_id == user.id)):
        buckets[min(4, int(m // 20))] += 1

    streak = progress_service.streaks(rows, day)
    return {
        "learned": learned, "mastered": mastered,
        "reviews": activity_repo.count_reviews(db, user.id, "review"),
        "seconds": sum(r.seconds for r in rows),
        "best_day": {"date": best.day, "new": best.new_learned, "reviewed": best.reviewed} if best else None,
        "current_streak": streak["current"], "best_streak": streak["best"],
        "active_days": sum(1 for r in rows if r.new_learned + r.reviewed > 0),
        "daily_average": round(total_new / span, 1),
        "mastery_rate": round(float(avg_mastery), 1),
        "this_week": weekly[-1], "last_week": weekly[-2],
        "daily": daily, "weekly": weekly,
        "mastery_distribution": [
            {"label": label, "count": count}
            for label, count in zip(["0–19", "20–39", "40–59", "60–79", "80–100"], buckets)
        ],
        "level": gamification.level_for(gamification.anchored_points(db, user.id)),
    }
