from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import RefreshToken, User


def get_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email.lower(), User.deleted_at.is_(None)))


def get(db: Session, user_id: int) -> User | None:
    return db.scalar(select(User).where(User.id == user_id, User.deleted_at.is_(None)))


def get_refresh_token(db: Session, token_hash: str) -> RefreshToken | None:
    return db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))


def revoke_all_tokens(db: Session, user_id: int, now: datetime) -> None:
    for t in db.scalars(select(RefreshToken).where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))):
        t.revoked_at = now
