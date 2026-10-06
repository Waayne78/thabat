from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    timezone: str | None = Field(default=None, max_length=64)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SettingsOut(ORMModel):
    theme: str
    timezone: str
    show_translation: bool
    show_transliteration: bool
    reciter: str
    arabic_font_scale: int
    max_reviews_per_day: int
    intention: str | None
    onboarding_completed: bool


class SettingsPatch(BaseModel):
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")
    timezone: str | None = Field(default=None, max_length=64)
    show_translation: bool | None = None
    show_transliteration: bool | None = None
    reciter: str | None = Field(default=None, max_length=40)
    arabic_font_scale: int | None = Field(default=None, ge=80, le=160)
    max_reviews_per_day: int | None = Field(default=None, ge=5, le=300)
    intention: str | None = Field(default=None, max_length=200)
    onboarding_completed: bool | None = None


class UserOut(ORMModel):
    id: int
    email: EmailStr
    display_name: str
    settings: SettingsOut


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut
