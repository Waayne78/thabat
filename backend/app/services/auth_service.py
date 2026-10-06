from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.config import get_settings
from app.core.errors import ConflictError, UnauthorizedError
from app.core.security import create_access_token, hash_password, hash_refresh_token, new_refresh_token, verify_password
from app.models import RefreshToken, User, UserSettings
from app.repositories import user_repo

# verifying against a dummy hash keeps login timing identical whether or not the account exists
_DUMMY_HASH = hash_password("thabat-timing-guard")


def register(db: Session, *, email: str, password: str, display_name: str, timezone: str | None) -> User:
    if user_repo.get_by_email(db, email):
        raise ConflictError("Un compte existe déjà avec cette adresse.", code="email_taken")
    user = User(email=email.lower(), password_hash=hash_password(password), display_name=display_name.strip())
    user.settings = UserSettings(timezone=timezone or get_settings().default_timezone)
    db.add(user)
    db.commit()
    return user


def authenticate(db: Session, *, email: str, password: str) -> User:
    user = user_repo.get_by_email(db, email)
    if not verify_password(password, user.password_hash if user else _DUMMY_HASH) or not user:
        raise UnauthorizedError("Adresse ou mot de passe incorrect.", code="invalid_credentials")
    return user


def issue_tokens(db: Session, user: User) -> tuple[str, str]:
    raw, token_hash = new_refresh_token()
    expires = utcnow() + timedelta(days=get_settings().refresh_token_days)
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires))
    db.commit()
    return create_access_token(user.id), raw


def rotate(db: Session, raw_refresh: str | None) -> tuple[User, str, str]:
    """Refresh-token rotation; replaying an already used token revokes the whole family."""
    if not raw_refresh:
        raise UnauthorizedError("Session expirée.", code="no_refresh_token")
    token = user_repo.get_refresh_token(db, hash_refresh_token(raw_refresh))
    now = utcnow()
    if not token:
        raise UnauthorizedError("Session expirée.", code="invalid_refresh_token")
    if token.revoked_at is not None:
        user_repo.revoke_all_tokens(db, token.user_id, now)
        db.commit()
        raise UnauthorizedError("Session expirée.", code="refresh_token_reused")
    expires = token.expires_at if token.expires_at.tzinfo else token.expires_at.replace(tzinfo=now.tzinfo)
    user = user_repo.get(db, token.user_id)
    if expires < now or not user:
        raise UnauthorizedError("Session expirée.", code="invalid_refresh_token")
    token.revoked_at = now
    access, raw = issue_tokens(db, user)
    return user, access, raw


def logout(db: Session, raw_refresh: str | None) -> None:
    if not raw_refresh:
        return
    token = user_repo.get_refresh_token(db, hash_refresh_token(raw_refresh))
    if token and token.revoked_at is None:
        token.revoked_at = utcnow()
        db.commit()
