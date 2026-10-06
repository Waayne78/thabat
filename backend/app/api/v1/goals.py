from fastapi import APIRouter, status

from app.api.deps import DB, CurrentUser, Today
from app.core.errors import NotFoundError
from app.repositories import goal_repo
from app.schemas.goal import GoalIn, GoalOut, GoalPatch, GoalPreviewIn
from app.services import goal_service

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(db: DB, user: CurrentUser, today: Today):
    mems = goal_service.mem_map(db, user.id)
    return [goal_service.serialize(db, user, g, today, mems) for g in goal_repo.list_for_user(db, user.id)]


@router.post("/preview")
def preview_goal(payload: GoalPreviewIn, db: DB, user: CurrentUser, today: Today) -> dict:
    """Pace options for a goal that is not created yet (used by onboarding and the goal form)."""
    return goal_service.preview(db, user, payload.items, payload.target_date, today, set(payload.exclude_ayah_ids))


@router.post("", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalIn, db: DB, user: CurrentUser, today: Today):
    return goal_service.serialize(db, user, goal_service.create(db, user, payload, today), today)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(goal_id: int, db: DB, user: CurrentUser, today: Today):
    goal = goal_repo.get(db, user.id, goal_id)
    if not goal:
        raise NotFoundError("Objectif introuvable.")
    return goal_service.serialize(db, user, goal, today)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, patch: GoalPatch, db: DB, user: CurrentUser, today: Today):
    return goal_service.serialize(db, user, goal_service.update(db, user, goal_id, patch, today), today)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: DB, user: CurrentUser) -> None:
    goal_service.delete(db, user, goal_id)
