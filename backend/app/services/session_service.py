from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import NotFoundError
from app.models import DailyProgress, Goal, Memorization, Review, ReviewSession, User
from app.repositories import activity_repo, goal_repo, memorization_repo, quran_repo
from app.schemas.activity import KnownIn, RecordIn
from app.services import gamification, goal_service, progress_service
from app.services.srs import CardState, apply_rating


def start_session(db: Session, user: User, mode: str, day: date) -> ReviewSession:
    session = ReviewSession(user_id=user.id, mode=mode, day=day)
    db.add(session)
    db.commit()
    return session


def _goal_mastery_snapshot(db: Session, user_id: int, goal: Goal) -> float:
    total = 0
    mastery = 0.0
    for item in goal.items:
        total += item.last_ayah_id - item.first_ayah_id + 1
        mastery += float(
            db.scalar(
                select(func.coalesce(func.sum(Memorization.mastery), 0)).where(
                    Memorization.user_id == user_id,
                    Memorization.ayah_id.between(item.first_ayah_id, item.last_ayah_id),
                )
            ) or 0
        )
    return round(mastery / total, 2) if total else 0.0


def _day_row(db: Session, user: User, goal: Goal | None, day: date) -> DailyProgress:
    row = activity_repo.get_day(db, user.id, day)
    if row:
        return row
    target = 0
    if goal:
        stats = goal_service.scope_stats(goal_service.ordered_ayah_ids(db, goal), goal_service.mem_map(db, user.id), day)
        target = goal_service.plan_for(db, user, goal, day, stats).today_new_target
    row = DailyProgress(user_id=user.id, day=day, target_new=target, new_learned=0, reviewed=0, seconds=0)
    db.add(row)
    db.flush()
    return row


def record(db: Session, user: User, payload: RecordIn, day: date) -> dict:
    """Registers one rated recitation: updates mastery + schedule, the day's progress and milestones."""
    if not quran_repo.get_ayah(db, payload.ayah_id):
        raise NotFoundError("Verset introuvable.")
    goal = goal_repo.get_primary(db, user.id)
    days_to_target = (goal.target_date - day).days if goal and goal.target_date else None
    row = _day_row(db, user, goal, day)  # before the update, so today's target is frozen first

    mem = memorization_repo.get(db, user.id, payload.ayah_id)
    if not mem:
        mem = Memorization(user_id=user.id, ayah_id=payload.ayah_id, due_date=day, mastery=0.0, ease=2.3,
                           interval_days=0, repetitions=0, lapses=0)
        db.add(mem)
    was_learned = mem.first_learned_at is not None
    before = mem.mastery
    state = CardState(mem.mastery, mem.ease, mem.interval_days, mem.repetitions, mem.lapses)
    out = apply_rating(state, payload.rating, day, mistakes=payload.mistakes, days_to_target=days_to_target)

    now = utcnow()
    mem.mastery, mem.ease = out.state.mastery, out.state.ease
    mem.interval_days, mem.repetitions, mem.lapses = out.state.interval_days, out.state.repetitions, out.state.lapses
    mem.due_date, mem.status, mem.last_reviewed_at = out.due_date, out.status, now
    newly_learned = not was_learned and out.status != "in_progress"
    if newly_learned:
        mem.first_learned_at, mem.learned_day = now, day
    newly_mastered = out.status == "mastered" and mem.mastered_at is None
    if out.status == "mastered":
        mem.mastered_at = mem.mastered_at or now
    else:
        mem.mastered_at = None

    session = activity_repo.get_session(db, user.id, payload.session_id) if payload.session_id else None
    db.add(Review(
        user_id=user.id, ayah_id=payload.ayah_id, session_id=session.id if session else None, day=day,
        kind="review" if was_learned else "learn", rating=payload.rating.value, mistakes=payload.mistakes,
        mastery_before=before, mastery_after=out.state.mastery, interval_after=out.state.interval_days,
    ))
    if newly_learned:
        row.new_learned += 1
    else:
        row.reviewed += 1
    if session:
        if newly_learned:
            session.new_count += 1
        else:
            session.review_count += 1
    db.flush()
    if goal:
        row.mastery_avg = _goal_mastery_snapshot(db, user.id, goal)

    streak = progress_service.streaks(activity_repo.all_days(db, user.id), day)
    unlocked = gamification.evaluate(
        db, user, current_streak=streak["current"], review_count=activity_repo.count_reviews(db, user.id)
    )
    db.commit()
    return {
        "ayah_id": payload.ayah_id, "kind": "review" if was_learned else "learn",
        "mastery_before": before, "mastery_after": out.state.mastery, "status": out.status,
        "due_date": out.due_date, "interval_days": out.state.interval_days,
        "newly_learned": newly_learned, "newly_mastered": newly_mastered, "unlocked": unlocked,
    }


def finish_session(db: Session, user: User, session_id: int, duration_seconds: int, day: date) -> dict:
    session = activity_repo.get_session(db, user.id, session_id)
    if not session:
        raise NotFoundError("Session introuvable.")
    if session.ended_at is None:
        session.ended_at = utcnow()
        session.duration_seconds = duration_seconds
        row = activity_repo.get_day(db, user.id, session.day)
        if row:
            row.seconds += duration_seconds
        db.commit()
    streak = progress_service.streaks(activity_repo.all_days(db, user.id), day)
    return {
        "id": session.id, "new_count": session.new_count, "review_count": session.review_count,
        "duration_seconds": session.duration_seconds, "streak": streak,
        "level": gamification.level_for(gamification.anchored_points(db, user.id)),
    }


KNOWN_LEVELS = {"solid": (75.0, 2, 4), "approximate": (45.0, 1, 2)}  # mastery, repetitions, interval
KNOWN_REVIEWS_PER_DAY = 12


def mark_known(db: Session, user: User, payload: KnownIn, day: date) -> dict:
    """Declares ayahs as already memorised. They start as "learned" (never "mastered"): the first
    reviews, spread over the coming days, confirm or correct the declared level."""
    from datetime import timedelta

    from sqlalchemy import select

    from app.models import Ayah

    wanted = sorted(set(payload.ayah_ids))
    existing = set(db.scalars(select(Ayah.id).where(Ayah.id.in_(wanted))))
    already = {m.ayah_id for m in memorization_repo.all_for_user(db, user.id)}
    new_ids = [i for i in wanted if i in existing and i not in already]
    mastery, reps, interval = KNOWN_LEVELS[payload.level]
    now = utcnow()
    for n, ayah_id in enumerate(new_ids):
        db.add(Memorization(
            user_id=user.id, ayah_id=ayah_id, status="learned", mastery=mastery, ease=2.3, interval_days=interval,
            repetitions=reps, lapses=0, due_date=day + timedelta(days=1 + n // KNOWN_REVIEWS_PER_DAY),
            first_learned_at=now, learned_day=None,
        ))
    # the plan must not read these as verses learned ahead of schedule
    for goal in goal_repo.list_for_user(db, user.id):
        if goal.kind == "scope":
            goal.baseline_learned += sum(
                1 for i in new_ids if any(it.first_ayah_id <= i <= it.last_ayah_id for it in goal.items)
            )
    db.commit()
    return {"marked": len(new_ids), "skipped": len(wanted) - len(new_ids)}
