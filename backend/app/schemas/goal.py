from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel


class GoalItemIn(BaseModel):
    kind: Literal["juz", "surah", "range"]
    ref_id: int | None = Field(default=None, ge=1, le=114)
    first_ayah_id: int | None = Field(default=None, ge=1, le=6236)
    last_ayah_id: int | None = Field(default=None, ge=1, le=6236)

    @model_validator(mode="after")
    def _check(self) -> "GoalItemIn":
        if self.kind in ("juz", "surah") and self.ref_id is None:
            raise ValueError("ref_id est requis pour un juz ou une sourate")
        if self.kind == "juz" and self.ref_id and self.ref_id > 30:
            raise ValueError("un juz est compris entre 1 et 30")
        if self.kind == "range" and (
            self.first_ayah_id is None or self.last_ayah_id is None or self.first_ayah_id > self.last_ayah_id
        ):
            raise ValueError("plage de versets invalide")
        return self


class GoalIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    kind: Literal["scope", "count", "daily", "weekly"] = "scope"
    target_date: date | None = None
    target_count: int | None = Field(default=None, ge=1, le=6236)
    daily_new: int | None = Field(default=None, ge=1, le=200)
    learning_order: Literal["short_first", "mushaf"] = "short_first"
    is_primary: bool = False
    items: list[GoalItemIn] = Field(default_factory=list, max_length=114)

    @model_validator(mode="after")
    def _check(self) -> "GoalIn":
        if self.kind == "scope" and (not self.items or self.target_date is None):
            raise ValueError("un objectif de mémorisation demande un contenu et une date cible")
        if self.kind in ("count", "daily", "weekly") and not self.target_count:
            raise ValueError("target_count est requis")
        if self.kind == "count" and self.target_date is None:
            raise ValueError("une date cible est requise")
        return self


class GoalPreviewIn(BaseModel):
    target_date: date
    items: list[GoalItemIn] = Field(min_length=1, max_length=114)
    exclude_ayah_ids: list[int] = Field(default_factory=list, max_length=6236)  # already known, not saved yet


class GoalPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=140)
    target_date: date | None = None
    target_count: int | None = Field(default=None, ge=1, le=6236)
    daily_new: int | None = Field(default=None, ge=1, le=200)
    learning_order: Literal["short_first", "mushaf"] | None = None
    is_primary: bool | None = None
    status: Literal["active", "completed", "archived"] | None = None


class GoalItemOut(ORMModel):
    id: int
    kind: str
    ref_id: int | None
    first_ayah_id: int
    last_ayah_id: int
    label: str = ""


class GoalOut(BaseModel):
    id: int
    title: str
    kind: str
    start_date: date
    target_date: date | None
    target_count: int | None
    daily_new: int | None
    learning_order: str
    is_primary: bool
    status: str
    items: list[GoalItemOut]
    total: int
    done: int
    mastered: int
    progress_pct: float
    days_left: int | None
    summary: str
    plan: dict | None = None
