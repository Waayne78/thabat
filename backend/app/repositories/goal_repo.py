from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Goal


def list_for_user(db: Session, user_id: int) -> list[Goal]:
    return list(
        db.scalars(
            select(Goal).options(selectinload(Goal.items))
            .where(Goal.user_id == user_id, Goal.deleted_at.is_(None))
            .order_by(Goal.is_primary.desc(), Goal.created_at)
        )
    )


def get(db: Session, user_id: int, goal_id: int) -> Goal | None:
    return db.scalar(
        select(Goal).options(selectinload(Goal.items))
        .where(Goal.id == goal_id, Goal.user_id == user_id, Goal.deleted_at.is_(None))
    )


def get_primary(db: Session, user_id: int) -> Goal | None:
    return db.scalar(
        select(Goal).options(selectinload(Goal.items))
        .where(Goal.user_id == user_id, Goal.deleted_at.is_(None), Goal.kind == "scope", Goal.status == "active")
        .order_by(Goal.is_primary.desc(), Goal.created_at)
        .limit(1)
    )
