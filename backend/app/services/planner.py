"""Automatic planning: pace, margin, ahead/behind, catch-up and projected end date. Pure functions."""
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from math import ceil

SECONDS_PER_NEW_AYAH = 80
SECONDS_PER_REVIEW = 25
CATCHUP_WINDOW_DAYS = 14


@dataclass(frozen=True)
class PaceOption:
    key: str  # gentle | balanced | intense
    label: str
    daily_new: int
    weekly_new: int
    finish_date: date
    margin_days: int
    minutes_per_day: int
    recommended: bool

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class Plan:
    total: int
    learned: int
    remaining: int
    days_left: int
    daily_new: int
    weekly_new: int
    today_new_target: int
    expected_learned: int
    delta_verses: int  # > 0 ahead, < 0 behind
    delta_days: int
    status: str  # ahead | on_track | behind | completed
    catchup_extra: int
    catchup_days: int
    margin_days: int
    projected_end: date | None
    required_daily: int  # strict minimum from now on to finish on the target date
    headline: str
    message: str

    def as_dict(self) -> dict:
        return asdict(self)


def estimate_minutes(new_count: int, review_count: int) -> int:
    seconds = new_count * SECONDS_PER_NEW_AYAH + review_count * SECONDS_PER_REVIEW
    return ceil(seconds / 60) if seconds else 0


def _steady_state_minutes(daily_new: int) -> int:
    # each learned ayah comes back ~5 times while it settles
    return estimate_minutes(daily_new, daily_new * 5)


def pace_options(total_remaining: int, today: date, target: date) -> list[PaceOption]:
    days_left = max(1, (target - today).days)
    specs = [("gentle", "Doux", 0.0), ("balanced", "Équilibré", 0.11), ("intense", "Soutenu", 0.27)]
    options: list[PaceOption] = []
    seen: set[int] = set()
    for key, label, buffer_ratio in specs:
        learning_days = max(1, days_left - round(days_left * buffer_ratio))
        daily = max(1, ceil(total_remaining / learning_days))
        if daily in seen:
            daily += 1
        seen.add(daily)
        duration = ceil(total_remaining / daily)
        options.append(
            PaceOption(
                key=key, label=label, daily_new=daily, weekly_new=daily * 7,
                finish_date=today + timedelta(days=duration), margin_days=days_left - duration,
                minutes_per_day=_steady_state_minutes(daily), recommended=key == "balanced",
            )
        )
    return options


def recommended_daily(total_remaining: int, today: date, target: date) -> int:
    days_left = max(1, (target - today).days)
    return max(1, ceil(total_remaining / max(1, days_left - round(days_left * 0.11))))


def _plural(n: int, word: str) -> str:
    return f"{n} {word}{'s' if n > 1 else ''}"


def build_plan(
    *, total: int, learned: int, learned_today: int, start: date, target: date, today: date,
    daily_new: int, recent_daily_avg: float | None = None, baseline_learned: int = 0,
) -> Plan:
    remaining = max(0, total - learned)
    days_left = max(0, (target - today).days)
    daily_new = max(1, daily_new)

    if remaining == 0:
        return Plan(
            total=total, learned=learned, remaining=0, days_left=days_left, daily_new=daily_new,
            weekly_new=daily_new * 7, today_new_target=0, expected_learned=total, delta_verses=0, delta_days=0,
            status="completed", catchup_extra=0, catchup_days=0, margin_days=days_left, projected_end=today,
            required_daily=0, headline="Tout est appris",
            message="Tous les versets sont appris. Place à l'ancrage : les révisions font le reste.",
        )

    # where the plan expected us to be at the end of yesterday (today is never counted against the user)
    elapsed = max(0, (today - start).days)
    expected = min(total, baseline_learned + daily_new * elapsed)
    before_today = learned - learned_today
    delta = before_today - expected
    delta_days = abs(delta) // daily_new

    catchup_extra = catchup_days = 0
    if delta < 0:
        behind = -delta
        catchup_extra = max(1, ceil(behind / CATCHUP_WINDOW_DAYS))
        catchup_days = ceil(behind / catchup_extra)
    today_target = min(daily_new + catchup_extra, total - before_today)

    remaining_before_today = total - before_today
    required_daily = ceil(remaining_before_today / max(1, days_left))
    plan_duration = ceil(remaining_before_today / (daily_new + (catchup_extra if catchup_days else 0)))
    margin = days_left - plan_duration

    pace = recent_daily_avg if recent_daily_avg and recent_daily_avg > 0 else float(daily_new)
    projected_end = today + timedelta(days=ceil(remaining / pace))

    if delta > 0:
        status = "ahead"
        headline = (
            f"Tu es en avance de {_plural(delta_days, 'jour')}" if delta_days >= 1
            else f"Tu es en avance de {_plural(delta, 'verset')}"
        )
        message = "Garde ce rythme, ou profite de l'avance pour consolider."
    elif delta < 0:
        status = "behind"
        behind = -delta
        headline = f"{_plural(behind, 'verset')} à rattraper, en douceur"
        window = f"pendant les {catchup_days} prochains jours" if catchup_days > 1 else "aujourd'hui"
        message = (
            f"Pour rester dans ton objectif, ajoute {_plural(catchup_extra, 'verset')} {window}. "
            "Le plan s'ajuste, ta date reste tenable."
        )
        if required_daily > daily_new * 2:
            message += " Si le rythme devient trop lourd, tu peux aussi décaler la date cible."
    else:
        status = "on_track"
        headline = "Tu es pile dans ton rythme"
        message = "La session d'aujourd'hui te maintient dans les temps."

    return Plan(
        total=total, learned=learned, remaining=remaining, days_left=days_left, daily_new=daily_new,
        weekly_new=daily_new * 7, today_new_target=max(0, today_target), expected_learned=expected,
        delta_verses=delta, delta_days=delta_days, status=status, catchup_extra=catchup_extra,
        catchup_days=catchup_days, margin_days=margin, projected_end=projected_end,
        required_daily=required_daily, headline=headline, message=message,
    )
