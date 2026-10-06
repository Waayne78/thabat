from datetime import date
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.clock import today_in
from app.core.errors import UnauthorizedError
from app.core.security import decode_access_token
from app.database.session import get_db
from app.models import User
from app.repositories import user_repo

_bearer = HTTPBearer(auto_error=False)

DB = Annotated[Session, Depends(get_db)]


def get_current_user(db: DB, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> User:
    user_id = decode_access_token(creds.credentials) if creds else None
    user = user_repo.get(db, user_id) if user_id else None
    if not user:
        raise UnauthorizedError("Authentification requise.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_today(user: CurrentUser) -> date:
    return today_in(user.settings.timezone)


Today = Annotated[date, Depends(get_today)]
