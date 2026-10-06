"""Spaced repetition + mastery scoring. Pure functions, no I/O.

Each ayah carries a mastery score (0..100) that moves towards a target depending on how the
recitation went, and an SM-2 style interval deciding when it comes back.
"Read" never means "mastered": reaching the mastered status takes several successful,
spaced recitations.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class Rating(str, Enum):
    very_easy = "very_easy"
    easy = "easy"
    medium = "medium"
    hard = "hard"
    forgotten = "forgotten"


# rating -> (score the mastery is pulled towards, strength of the pull)
MASTERY_PULL: dict[Rating, tuple[float, float]] = {
    Rating.very_easy: (100, 0.45),
    Rating.easy: (100, 0.30),
    Rating.medium: (78, 0.30),
    Rating.hard: (50, 0.40),
    Rating.forgotten: (15, 0.60),
}

LEARNED_THRESHOLD = 20.0
MASTERED_THRESHOLD = 85.0
MASTERED_MIN_REPETITIONS = 3
MIN_EASE, MAX_EASE = 1.3, 3.0
MAX_INTERVAL = 120


@dataclass(frozen=True)
class CardState:
    mastery: float = 0.0
    ease: float = 2.3
    interval_days: int = 0
    repetitions: int = 0
    lapses: int = 0


@dataclass(frozen=True)
class Outcome:
    state: CardState
    due_date: date
    status: str  # in_progress | learned | mastered


def _next_mastery(mastery: float, rating: Rating, mistakes: int) -> float:
    target, pull = MASTERY_PULL[rating]
    if rating in (Rating.hard, Rating.forgotten) and mastery < target:
        # a weak recitation never raises the score of an already weak ayah by much
        pull *= 0.5
    value = mastery + (target - mastery) * pull
    value -= min(12, 3 * max(0, mistakes))
    return round(max(0.0, min(100.0, value)), 1)


def _next_schedule(s: CardState, rating: Rating) -> tuple[float, int, int, int]:
    ease, interval, reps, lapses = s.ease, s.interval_days, s.repetitions, s.lapses
    if rating is Rating.forgotten:
        return max(MIN_EASE, ease - 0.2), 1, 0, lapses + 1
    if rating is Rating.hard:
        return max(MIN_EASE, ease - 0.15), max(1, round(interval * 0.6)), reps, lapses
    reps += 1
    first, second, factor = {Rating.medium: (1, 3, 0.8), Rating.easy: (2, 4, 1.0), Rating.very_easy: (3, 7, 1.3)}[rating]
    if rating is Rating.very_easy:
        ease = min(MAX_EASE, ease + 0.1)
    if reps == 1:
        interval = first
    elif reps == 2:
        interval = max(second, interval + 1)
    else:
        interval = max(interval + 1, round(interval * ease * factor))
    return ease, interval, reps, lapses


def apply_rating(
    state: CardState, rating: Rating, today: date, *, mistakes: int = 0, days_to_target: int | None = None
) -> Outcome:
    mastery = _next_mastery(state.mastery, rating, mistakes)
    ease, interval, reps, lapses = _next_schedule(state, rating)
    interval = min(interval, MAX_INTERVAL)
    if days_to_target is not None and days_to_target > 0:
        # the closer the deadline, the tighter the loop: always leave room for more passes
        interval = min(interval, max(2, days_to_target // 3))
    if mastery >= MASTERED_THRESHOLD and reps >= MASTERED_MIN_REPETITIONS:
        status = "mastered"
    elif mastery >= LEARNED_THRESHOLD:
        status = "learned"
    else:
        status = "in_progress"
    new_state = CardState(mastery=mastery, ease=round(ease, 2), interval_days=interval, repetitions=reps, lapses=lapses)
    return Outcome(state=new_state, due_date=today + timedelta(days=interval), status=status)


def effective_mastery(mastery: float, due_date: date, today: date) -> float:
    """Memory fades when a review is overdue: 2 % per late day, floor at 60 % of the stored score."""
    overdue = (today - due_date).days
    if overdue <= 0:
        return round(mastery, 1)
    return round(mastery * max(0.6, 1 - 0.02 * overdue), 1)


def effective_status(status: str, due_date: date, today: date) -> str:
    """to_learn | in_progress | learned | to_review | mastered (to_review is derived from the due date)."""
    if status != "in_progress" and due_date <= today:
        return "to_review"
    return status


def review_priority(
    *, mastery: float, lapses: int, due_date: date, today: date, days_to_target: int | None = None
) -> float:
    """Higher = review first. Combines lateness, weakness, past slips and deadline proximity."""
    overdue = max(0, (today - due_date).days)
    weakness = (100 - mastery) / 8
    urgency = 0.0
    if days_to_target is not None:
        urgency = 10 * (1 - min(max(days_to_target, 0), 90) / 90) * (100 - mastery) / 100
    return round(overdue * 1.5 + weakness + lapses * 4 + urgency, 2)


def suggest_rating(mistakes: int, peeked: bool = False) -> Rating:
    if mistakes == 0:
        return Rating.medium if peeked else Rating.easy
    if mistakes == 1:
        return Rating.medium
    if mistakes <= 3:
        return Rating.hard
    return Rating.forgotten
