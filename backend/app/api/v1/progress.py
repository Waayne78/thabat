from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import DB, CurrentUser, Today
from app.core.errors import AppError
from app.repositories import goal_repo
from app.schemas.activity import KnownIn, RecordIn, SessionFinishIn, SessionIn
from app.services import gamification, progress_service, session_service, stats_service

router = APIRouter(tags=["progress"])


@router.get("/progress")
def get_progress(db: DB, user: CurrentUser, today: Today) -> dict:
    return progress_service.overview(db, user, today)


@router.get("/progress/today")
def get_today(db: DB, user: CurrentUser, today: Today, extra: Annotated[int, Query(ge=0, le=50)] = 0) -> dict:
    return progress_service.today(db, user, today, extra)


@router.get("/progress/calendar")
def get_calendar(db: DB, user: CurrentUser, today: Today, start: date | None = None, end: date | None = None) -> dict:
    end = end or today
    start = start or end - timedelta(days=41)
    if start > end or (end - start).days > 800:
        raise AppError("Période invalide.", code="invalid_range")
    return progress_service.calendar(db, user, start, end, today)


@router.get("/reviews/today")
def reviews_today(db: DB, user: CurrentUser, today: Today) -> dict:
    goal = goal_repo.get_primary(db, user.id)
    days_to_target = (goal.target_date - today).days if goal and goal.target_date else None
    queue = progress_service.review_queue(db, user, today, days_to_target)
    return {"total": len(queue), "items": [progress_service.review_item(m, p, today, user.settings.reciter) for m, p in queue]}


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def start_session(payload: SessionIn, db: DB, user: CurrentUser, today: Today) -> dict:
    session = session_service.start_session(db, user, payload.mode, today)
    return {"id": session.id, "mode": session.mode}


@router.post("/sessions/{session_id}/finish")
def finish_session(session_id: int, payload: SessionFinishIn, db: DB, user: CurrentUser, today: Today) -> dict:
    return session_service.finish_session(db, user, session_id, payload.duration_seconds, today)


@router.post("/memorization", status_code=status.HTTP_201_CREATED)
def record_memorization(payload: RecordIn, db: DB, user: CurrentUser, today: Today) -> dict:
    """First rated recitation of a new ayah (also accepts further attempts while it is still in progress)."""
    return session_service.record(db, user, payload, today)


@router.post("/memorization/known", status_code=status.HTTP_201_CREATED)
def mark_known(payload: KnownIn, db: DB, user: CurrentUser, today: Today) -> dict:
    return session_service.mark_known(db, user, payload, today)


@router.post("/reviews", status_code=status.HTTP_201_CREATED)
def record_review(payload: RecordIn, db: DB, user: CurrentUser, today: Today) -> dict:
    return session_service.record(db, user, payload, today)


@router.get("/statistics")
def statistics(db: DB, user: CurrentUser, today: Today) -> dict:
    return stats_service.statistics(db, user, today)


@router.get("/achievements")
def achievements(db: DB, user: CurrentUser) -> dict:
    return gamification.list_for(db, user)
