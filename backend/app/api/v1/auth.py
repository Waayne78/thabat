from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.rate_limit import auth_rate_limit
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, SettingsPatch, TokenOut, UserOut, UserPatch
from app.services import auth_service

router = APIRouter(tags=["auth"])
COOKIE = "thabat_rt"
RefreshCookie = Annotated[str | None, Cookie(alias=COOKIE)]


def _respond(response: Response, user: User, access: str, refresh: str) -> TokenOut:
    s = get_settings()
    # the refresh token never reaches JavaScript: httpOnly cookie scoped to the auth routes
    response.set_cookie(
        COOKIE, refresh, max_age=s.refresh_token_days * 86400, httponly=True, secure=s.cookie_secure,
        samesite="lax", path="/api/v1/auth",
    )
    return TokenOut(access_token=access, expires_in=s.access_token_minutes * 60, user=UserOut.model_validate(user))


@router.post("/auth/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(auth_rate_limit)])
def register(payload: RegisterIn, response: Response, db: DB) -> TokenOut:
    user = auth_service.register(db, **payload.model_dump())
    return _respond(response, user, *auth_service.issue_tokens(db, user))


@router.post("/auth/login", response_model=TokenOut, dependencies=[Depends(auth_rate_limit)])
def login(payload: LoginIn, response: Response, db: DB) -> TokenOut:
    user = auth_service.authenticate(db, email=payload.email, password=payload.password)
    return _respond(response, user, *auth_service.issue_tokens(db, user))


@router.post("/auth/refresh", response_model=TokenOut)
def refresh(response: Response, db: DB, token: RefreshCookie = None) -> TokenOut:
    user, access, new_refresh = auth_service.rotate(db, token)
    return _respond(response, user, access, new_refresh)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, db: DB, token: RefreshCookie = None) -> None:
    auth_service.logout(db, token)
    response.delete_cookie(COOKIE, path="/api/v1/auth")


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(patch: UserPatch, user: CurrentUser, db: DB) -> User:
    if patch.display_name:
        user.display_name = patch.display_name.strip()
    db.commit()
    return user


@router.patch("/me/settings", response_model=UserOut)
def update_settings(patch: SettingsPatch, user: CurrentUser, db: DB) -> User:
    for key, value in patch.model_dump(exclude_unset=True).items():
        if value is not None or key == "intention":
            setattr(user.settings, key, value)
    db.commit()
    return user
