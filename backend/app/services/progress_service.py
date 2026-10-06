from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import DailyProgress, Memorization, User
from app.repositories import activity_repo, goal_repo, memorization_repo, quran_repo
from app.services import goal_service, planner
from app.services.quran_service import ayah_out
from app.services.srs import effective_mastery, effective_status, review_priority


def streaks(rows: list[DailyProgress], today: date) -> dict:
    active = sorted({r.day for r in rows if r.new_learned + r.reviewed > 0})
    best = run = 0
    prev: date | None = None
    for d in active:
        run = run + 1 if prev and (d - prev).days == 1 else 1
        best = max(best, run)
        prev = d
    days = set(active)
    cursor = today if today in days else today - timedelta(days=1)
    current = 0
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    return {"current": current, "best": best, "active_today": today in days}


def day_status(row: DailyProgress | None, day: date, today: date, tracking_since: date | None) -> str:
    """done | partial | review | missed | today | rest | future"""
    if day > today:
        return "future"
    if row and row.new_learned + row.reviewed > 0:
        if row.target_new > 0 and row.new_learned >= row.target_new:
            return "done"
        if row.new_learned == 0:
            return "review"
        return "partial"
    if day == today:
        return "today"
    if tracking_since and day >= tracking_since:
        return "missed"
    return "rest"


def review_queue(db: Session, user: User, today: date, days_to_target: int | None) -> list[tuple[Memorization, float]]:
    scored = [
        (m, review_priority(mastery=m.mastery, lapses=m.lapses, due_date=m.due_date, today=today, days_to_target=days_to_target))
        for m in memorization_repo.due(db, user.id, today)
    ]
    scored.sort(key=lambda x: (-x[1], x[0].ayah_id))
    return scored


def review_item(m: Memorization, priority: float, today: date, reciter: str) -> dict:
    return {
        "ayah": ayah_out(m.ayah, reciter), "mastery": effective_mastery(m.mastery, m.due_date, today),
        "status": effective_status(m.status, m.due_date, today), "priority": priority, "due_date": m.due_date,
        "overdue_days": max(0, (today - m.due_date).days), "lapses": m.lapses, "repetitions": m.repetitions,
    }


def today(db: Session, user: User, day: date, extra: int = 0) -> dict:
    goal = goal_repo.get_primary(db, user.id)
    rows = activity_repo.all_days(db, user.id)
    row = next((r for r in rows if r.day == day), None)
    reciter = user.settings.reciter
    base = {
        "date": day, "display_name": user.display_name, "streak": streaks(rows, day),
        "new_done": row.new_learned if row else 0, "review_done": row.reviewed if row else 0,
        "seconds_today": row.seconds if row else 0,
    }
    days_to_target = (goal.target_date - day).days if goal and goal.target_date else None
    queue = review_queue(db, user, day, days_to_target)
    cap = max(0, user.settings.max_reviews_per_day - base["review_done"])
    reviews = [review_item(m, p, day, reciter) for m, p in queue[:cap]]
    if not goal:
        return {**base, "goal": None, "plan": None, "progress_pct": 0, "counts": None, "new_ayahs": [],
                "new_target": 0, "reviews": reviews, "review_total_due": len(queue),
                "estimated_minutes": planner.estimate_minutes(0, len(reviews)), "status": "today"}

    ids = goal_service.ordered_ayah_ids(db, goal)
    mems = goal_service.mem_map(db, user.id)
    stats = goal_service.scope_stats(ids, mems, day)
    plan = goal_service.plan_for(db, user, goal, day, stats)
    remaining_new = max(0, plan.today_new_target - stats["learned_today"]) + max(0, extra)
    next_ids = [i for i in ids if i not in mems][:remaining_new]
    new_ayahs = [ayah_out(a, reciter) for a in quran_repo.ayahs_by_ids(db, next_ids)]
    return {
        **base,
        "goal": {"id": goal.id, "title": goal.title, "target_date": goal.target_date, "start_date": goal.start_date},
        "plan": plan.as_dict(), "progress_pct": stats["progress_pct"], "counts": stats["counts"],
        "learned": stats["learned"], "mastered": stats["mastered"], "total": stats["total"],
        "new_target": plan.today_new_target, "new_done": stats["learned_today"], "new_ayahs": new_ayahs,
        "reviews": reviews, "review_total_due": len(queue),
        "estimated_minutes": planner.estimate_minutes(len(new_ayahs), len(reviews)),
        "status": day_status(row, day, day, goal.start_date),
        "all_done": not new_ayahs and not reviews and base["new_done"] + base["review_done"] > 0,
    }


def overview(db: Session, user: User, day: date) -> dict:
    """Mastery map of the primary goal: every ayah with its real mastery, grouped by surah."""
    goal = goal_repo.get_primary(db, user.id)
    recent = [
        {"ayah_id": m.ayah_id, "surah_name": m.ayah.surah.name_translit, "number": m.ayah.number_in_surah,
         "mastery": m.mastery, "mastered_at": m.mastered_at}
        for m in memorization_repo.recently_mastered(db, user.id)
    ]
    if not goal:
        return {"goal": None, "surahs": [], "recently_mastered": recent, "counts": None, "progress_pct": 0}
    ids = goal_service.ordered_ayah_ids(db, goal)
    mems = goal_service.mem_map(db, user.id)
    stats = goal_service.scope_stats(ids, mems, day)
    id_set = set(ids)
    surahs = []
    order: list[int] = []
    juz_list = quran_repo.list_juz(db)
    for item in goal.items:
        for s in quran_repo.surah_bounds(db, item.first_ayah_id, item.last_ayah_id):
            if s.id in order:
                continue
            order.append(s.id)
            cells = []
            total = 0.0
            for n in range(s.ayah_count):
                aid = s.first_ayah_id + n
                if aid not in id_set:
                    continue
                m = mems.get(aid)
                mastery = effective_mastery(m.mastery, m.due_date, day) if m else 0.0
                total += mastery
                cells.append({
                    "ayah_id": aid, "number": n + 1, "mastery": mastery,
                    "status": effective_status(m.status, m.due_date, day) if m else "to_learn",
                    "due_date": m.due_date if m else None,
                })
            surahs.append({
                "id": s.id, "name": s.name_translit, "name_ar": s.name_ar, "ayah_count": len(cells),
                "juz": next((j.id for j in juz_list if j.first_ayah_id <= s.first_ayah_id <= j.last_ayah_id), None),
                "mastery": round(total / len(cells), 1) if cells else 0.0,
                "learned": sum(1 for c in cells if c["status"] in ("learned", "to_review", "mastered")),
                "cells": cells,
            })
    return {
        "goal": {"id": goal.id, "title": goal.title, "target_date": goal.target_date},
        "surahs": surahs, "recently_mastered": recent, "counts": stats["counts"],
        "progress_pct": stats["progress_pct"], "total": stats["total"],
    }


def calendar(db: Session, user: User, start: date, end: date, day: date) -> dict:
    goal = goal_repo.get_primary(db, user.id)
    all_rows = activity_repo.all_days(db, user.id)
    by_day = {r.day: r for r in all_rows}
    since = goal.start_date if goal else (all_rows[0].day if all_rows else None)
    days = []
    cursor = start
    while cursor <= end:
        r = by_day.get(cursor)
        days.append({
            "date": cursor, "status": day_status(r, cursor, day, since),
            "new": r.new_learned if r else 0, "reviewed": r.reviewed if r else 0,
            "seconds": r.seconds if r else 0, "target_new": r.target_new if r else 0,
        })
        cursor += timedelta(days=1)
    return {
        "days": days, "streak": streaks(all_rows, day), "tracking_since": since,
        "target_date": goal.target_date if goal else None,
    }
