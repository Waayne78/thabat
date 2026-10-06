from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.errors import AppError, NotFoundError
from app.models import Goal, GoalItem, Memorization, User
from app.repositories import activity_repo, goal_repo, memorization_repo, quran_repo
from app.schemas.goal import GoalIn, GoalItemIn, GoalItemOut, GoalOut, GoalPatch
from app.services import planner
from app.services.srs import effective_mastery, effective_status


# ---------- scope resolution ----------

def _resolve_item(db: Session, item: GoalItemIn, position: int) -> GoalItem:
    if item.kind == "juz":
        juz = quran_repo.get_juz(db, item.ref_id or 0)
        if not juz:
            raise NotFoundError("Juz introuvable.")
        first, last = juz.first_ayah_id, juz.last_ayah_id
    elif item.kind == "surah":
        surah = quran_repo.get_surah(db, item.ref_id or 0)
        if not surah:
            raise NotFoundError("Sourate introuvable.")
        first, last = surah.first_ayah_id, surah.first_ayah_id + surah.ayah_count - 1
    else:
        first, last = item.first_ayah_id or 0, item.last_ayah_id or 0
    return GoalItem(position=position, kind=item.kind, ref_id=item.ref_id, first_ayah_id=first, last_ayah_id=last)


def ordered_ayah_ids(db: Session, goal: Goal) -> list[int]:
    """Ayahs of a scope goal in learning order (short surahs first by default, verses always ascending)."""
    ids: list[int] = []
    seen: set[int] = set()
    for item in goal.items:
        surahs = quran_repo.surah_bounds(db, item.first_ayah_id, item.last_ayah_id)
        if goal.learning_order == "short_first":
            surahs = surahs[::-1]
        for s in surahs:
            lo = max(s.first_ayah_id, item.first_ayah_id)
            hi = min(s.first_ayah_id + s.ayah_count - 1, item.last_ayah_id)
            for i in range(lo, hi + 1):
                if i not in seen:
                    seen.add(i)
                    ids.append(i)
    return ids


def mem_map(db: Session, user_id: int) -> dict[int, Memorization]:
    return {m.ayah_id: m for m in memorization_repo.all_for_user(db, user_id)}


def scope_stats(ids: list[int], mems: dict[int, Memorization], today: date) -> dict:
    counts = {"to_learn": 0, "in_progress": 0, "learned": 0, "to_review": 0, "mastered": 0}
    mastery_sum = 0.0
    learned = learned_today = 0
    for i in ids:
        m = mems.get(i)
        if not m:
            counts["to_learn"] += 1
            continue
        counts[effective_status(m.status, m.due_date, today)] += 1
        mastery_sum += effective_mastery(m.mastery, m.due_date, today)
        if m.first_learned_at is not None:
            learned += 1
            if m.learned_day == today:
                learned_today += 1
    total = len(ids)
    return {
        "total": total, "counts": counts, "learned": learned, "learned_today": learned_today,
        "mastered": sum(1 for i in ids if (m := mems.get(i)) and m.status == "mastered"),
        "progress_pct": round(mastery_sum / total, 1) if total else 0.0,
    }


def recent_daily_avg(db: Session, user_id: int, today: date) -> float | None:
    rows = activity_repo.days_between(db, user_id, today - timedelta(days=14), today - timedelta(days=1))
    if len(rows) < 3:
        return None
    return sum(r.new_learned for r in rows) / 14


def plan_for(db: Session, user: User, goal: Goal, today: date, stats: dict) -> planner.Plan:
    assert goal.target_date is not None
    return planner.build_plan(
        total=stats["total"], learned=stats["learned"], learned_today=stats["learned_today"],
        start=goal.baseline_date or goal.start_date, target=goal.target_date, today=today,
        daily_new=goal.daily_new or 1, recent_daily_avg=recent_daily_avg(db, user.id, today),
        baseline_learned=goal.baseline_learned,
    )


# ---------- serialisation ----------

def _item_label(db: Session, item: GoalItem) -> str:
    if item.kind == "juz":
        return {30: "Juz' ʿAmma", 29: "Juz' Tabārak"}.get(item.ref_id or 0, f"Juz' {item.ref_id}")
    if item.kind == "surah":
        s = quran_repo.get_surah(db, item.ref_id or 0)
        return f"Sourate {s.name_translit}" if s else f"Sourate {item.ref_id}"
    return f"{item.last_ayah_id - item.first_ayah_id + 1} versets"


def serialize(db: Session, user: User, goal: Goal, today: date, mems: dict[int, Memorization] | None = None) -> GoalOut:
    items = [
        GoalItemOut(id=i.id, kind=i.kind, ref_id=i.ref_id, first_ayah_id=i.first_ayah_id,
                    last_ayah_id=i.last_ayah_id, label=_item_label(db, i))
        for i in goal.items
    ]
    days_left = max(0, (goal.target_date - today).days) if goal.target_date else None
    plan = None
    mastered = 0
    if goal.kind == "scope":
        stats = scope_stats(ordered_ayah_ids(db, goal), mems if mems is not None else mem_map(db, user.id), today)
        total, done, mastered, pct = stats["total"], stats["learned"], stats["mastered"], stats["progress_pct"]
        p = plan_for(db, user, goal, today, stats)
        plan = p.as_dict()
        summary = f"{done} appris · {mastered} maîtrisés sur {total} versets"
    else:
        total = goal.target_count or 0
        if goal.kind == "daily":
            start, end, period = today, today, "aujourd'hui"
        elif goal.kind == "weekly":
            start, end, period = today - timedelta(days=today.weekday()), today, "cette semaine"
        else:
            start, end, period = goal.start_date, goal.target_date or today, "sur la période"
        done = min(total, activity_repo.learned_between(db, user.id, start, end))
        pct = round(100 * done / total, 1) if total else 0.0
        summary = f"{done} / {total} versets {period}"
    return GoalOut(
        id=goal.id, title=goal.title, kind=goal.kind, start_date=goal.start_date, target_date=goal.target_date,
        target_count=goal.target_count, daily_new=goal.daily_new, learning_order=goal.learning_order,
        is_primary=goal.is_primary, status=goal.status, items=items, total=total, done=done, mastered=mastered,
        progress_pct=pct, days_left=days_left, summary=summary, plan=plan,
    )


# ---------- commands ----------

def preview(
    db: Session, user: User, items: list[GoalItemIn], target_date: date, today: date, exclude: set[int] | None = None
) -> dict:
    if target_date <= today:
        raise AppError("La date cible doit être dans le futur.", code="invalid_target_date")
    goal = Goal(learning_order="short_first", items=[_resolve_item(db, it, n) for n, it in enumerate(items)])
    ids = ordered_ayah_ids(db, goal)
    mems = mem_map(db, user.id)
    exclude = exclude or set()
    remaining = sum(1 for i in ids if i not in exclude and not (mems.get(i) and mems[i].first_learned_at))
    return {
        "total": len(ids), "remaining": remaining, "days_left": (target_date - today).days,
        "options": [o.as_dict() for o in planner.pace_options(max(1, remaining), today, target_date)],
    }


def _rebaseline(db: Session, user: User, goal: Goal, today: date, *, recompute_pace: bool) -> None:
    stats = scope_stats(ordered_ayah_ids(db, goal), mem_map(db, user.id), today)
    remaining = max(1, stats["total"] - stats["learned"])
    if recompute_pace and goal.target_date:
        goal.daily_new = planner.recommended_daily(remaining, today, goal.target_date)
    goal.baseline_date = today
    goal.baseline_learned = stats["learned"] - stats["learned_today"]


def _make_primary(db: Session, user: User, goal: Goal) -> None:
    for g in goal_repo.list_for_user(db, user.id):
        g.is_primary = g is goal
    goal.is_primary = True


def create(db: Session, user: User, payload: GoalIn, today: date) -> Goal:
    if payload.target_date and payload.target_date <= today:
        raise AppError("La date cible doit être dans le futur.", code="invalid_target_date")
    goal = Goal(
        user_id=user.id, title=payload.title.strip(), kind=payload.kind, start_date=today,
        target_date=payload.target_date, target_count=payload.target_count, daily_new=payload.daily_new,
        learning_order=payload.learning_order,
        items=[_resolve_item(db, it, n) for n, it in enumerate(payload.items)] if payload.kind == "scope" else [],
    )
    db.add(goal)
    db.flush()
    if goal.kind == "scope":
        _rebaseline(db, user, goal, today, recompute_pace=payload.daily_new is None)
        if payload.is_primary or goal_repo.get_primary(db, user.id) in (None, goal):
            _make_primary(db, user, goal)
    db.commit()
    return goal


def update(db: Session, user: User, goal_id: int, patch: GoalPatch, today: date) -> Goal:
    goal = goal_repo.get(db, user.id, goal_id)
    if not goal:
        raise NotFoundError("Objectif introuvable.")
    data = patch.model_dump(exclude_unset=True)
    if "target_date" in data and data["target_date"] and data["target_date"] <= today:
        raise AppError("La date cible doit être dans le futur.", code="invalid_target_date")
    make_primary = data.pop("is_primary", None)
    for key, value in data.items():
        setattr(goal, key, value)
    if goal.kind == "scope" and ({"target_date", "daily_new"} & data.keys()):
        _rebaseline(db, user, goal, today, recompute_pace="daily_new" not in data)
    if make_primary and goal.kind == "scope":
        _make_primary(db, user, goal)
    db.commit()
    return goal


def delete(db: Session, user: User, goal_id: int) -> None:
    from app.core.clock import utcnow

    goal = goal_repo.get(db, user.id, goal_id)
    if not goal:
        raise NotFoundError("Objectif introuvable.")
    goal.deleted_at = utcnow()
    goal.is_primary = False
    db.commit()
