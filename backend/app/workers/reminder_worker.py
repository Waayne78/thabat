"""Reminder worker: every minute, finds the reminders due in each user's local time and hands the
composed message to a delivery channel.

    python -m app.workers.reminder_worker

The default channel only logs. Plug Web Push / e-mail / FCM by implementing `Channel`.
While the web app is open it also schedules the same messages locally (Notification API).
"""
import logging
import time as time_module
from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models import Reminder, User
from app.services import progress_service, reminder_service

log = logging.getLogger("thabat.reminders")


class Channel(Protocol):
    def send(self, user: User, message: str) -> None: ...


class LogChannel:
    def send(self, user: User, message: str) -> None:
        log.info("reminder -> %s: %s", user.email, message)


def run_once(db: Session, channel: Channel, now_utc: datetime | None = None) -> int:
    now_utc = now_utc or utcnow()
    sent = 0
    rows = db.execute(
        select(Reminder, User).join(User, User.id == Reminder.user_id)
        .where(Reminder.enabled.is_(True), Reminder.deleted_at.is_(None), User.deleted_at.is_(None))
    ).all()
    for reminder, user in rows:
        try:
            local = now_utc.astimezone(ZoneInfo(user.settings.timezone))
        except Exception:
            local = now_utc
        if local.weekday() not in reminder.days or (local.hour, local.minute) != (reminder.time.hour, reminder.time.minute):
            continue
        if reminder.frequency == "weekly" and local.weekday() != min(reminder.days):
            continue
        last = reminder.last_sent_at
        if last and (now_utc - (last if last.tzinfo else last.replace(tzinfo=now_utc.tzinfo))).total_seconds() < 120:
            continue
        message, pending = reminder_service.compose(reminder.kind, progress_service.today(db, user, local.date()))
        if reminder.frequency == "if_pending" and not pending:
            continue
        channel.send(user, message)
        reminder.last_sent_at = now_utc
        sent += 1
    db.commit()
    return sent


def main() -> None:
    from app.database.session import SessionLocal

    logging.basicConfig(level=logging.INFO)
    channel = LogChannel()
    log.info("reminder worker started")
    while True:
        with SessionLocal() as db:
            run_once(db, channel)
        time_module.sleep(60 - datetime.now().second)


if __name__ == "__main__":
    main()
