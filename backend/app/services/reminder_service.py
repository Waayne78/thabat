from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.core.errors import NotFoundError
from app.models import Reminder, User
from app.schemas.activity import ReminderIn, ReminderPatch
from app.services import progress_service


def list_for(db: Session, user_id: int) -> list[Reminder]:
    return list(
        db.scalars(select(Reminder).where(Reminder.user_id == user_id, Reminder.deleted_at.is_(None)).order_by(Reminder.time))
    )


def _get(db: Session, user_id: int, reminder_id: int) -> Reminder:
    r = db.scalar(select(Reminder).where(Reminder.id == reminder_id, Reminder.user_id == user_id, Reminder.deleted_at.is_(None)))
    if not r:
        raise NotFoundError("Rappel introuvable.")
    return r


def create(db: Session, user: User, payload: ReminderIn) -> Reminder:
    r = Reminder(user_id=user.id, **payload.model_dump())
    r.days = sorted({d for d in payload.days if 0 <= d <= 6})
    db.add(r)
    db.commit()
    return r


def update(db: Session, user: User, reminder_id: int, patch: ReminderPatch) -> Reminder:
    r = _get(db, user.id, reminder_id)
    for key, value in patch.model_dump(exclude_unset=True).items():
        setattr(r, key, sorted({d for d in value if 0 <= d <= 6}) if key == "days" else value)
    db.commit()
    return r


def delete(db: Session, user: User, reminder_id: int) -> None:
    _get(db, user.id, reminder_id).deleted_at = utcnow()
    db.commit()


def compose(kind: str, today: dict) -> tuple[str, bool]:
    """Returns (message, has_pending_work). Tone: an invitation, never a reproach."""
    plan = today.get("plan")
    remaining_new = len(today["new_ayahs"])
    reviews = len(today["reviews"])
    pending = remaining_new + reviews > 0
    if kind == "review":
        if reviews:
            return f"Ta session de révision t'attend : {reviews} verset{'s' if reviews > 1 else ''} à consolider.", True
        return "Aucune révision en attente aujourd'hui. Ta mémoire est à jour.", False
    if kind == "deadline" and plan:
        return f"Tu es à {plan['days_left']} jours de ton objectif. {plan['headline']}.", pending
    if kind == "encouragement" and plan:
        return f"{plan['headline']}. {plan['message']}", pending
    if remaining_new:
        return f"Il te reste {remaining_new} verset{'s' if remaining_new > 1 else ''} aujourd'hui.", True
    if reviews:
        return f"Encore {reviews} verset{'s' if reviews > 1 else ''} à réviser, et ta journée est complète.", True
    return "Session du jour accomplie. Qu'Allah te facilite la suite.", False


def serialize(r: Reminder, today: dict) -> dict:
    message, pending = compose(r.kind, today)
    return {
        "id": r.id, "kind": r.kind, "time": r.time.strftime("%H:%M"), "days": r.days, "frequency": r.frequency,
        "enabled": r.enabled, "preview": message, "pending": pending,
    }


def list_serialized(db: Session, user: User, day: date) -> list[dict]:
    today = progress_service.today(db, user, day)
    return [serialize(r, today) for r in list_for(db, user.id)]
