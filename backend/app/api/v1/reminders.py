from fastapi import APIRouter, status

from app.api.deps import DB, CurrentUser, Today
from app.schemas.activity import ReminderIn, ReminderPatch
from app.services import progress_service, reminder_service

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("")
def list_reminders(db: DB, user: CurrentUser, today: Today) -> list[dict]:
    return reminder_service.list_serialized(db, user, today)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_reminder(payload: ReminderIn, db: DB, user: CurrentUser, today: Today) -> dict:
    r = reminder_service.create(db, user, payload)
    return reminder_service.serialize(r, progress_service.today(db, user, today))


@router.patch("/{reminder_id}")
def update_reminder(reminder_id: int, patch: ReminderPatch, db: DB, user: CurrentUser, today: Today) -> dict:
    r = reminder_service.update(db, user, reminder_id, patch)
    return reminder_service.serialize(r, progress_service.today(db, user, today))


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reminder(reminder_id: int, db: DB, user: CurrentUser) -> None:
    reminder_service.delete(db, user, reminder_id)
