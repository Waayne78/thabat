from datetime import date, timedelta

from app.services.planner import build_plan, pace_options

TODAY = date(2026, 10, 6)
RAMADAN = date(2027, 2, 8)


def test_initial_goal_numbers():
    assert (RAMADAN - TODAY).days == 125
    gentle, balanced, intense = pace_options(995, TODAY, RAMADAN)
    assert gentle.daily_new == 8 and gentle.margin_days == 0
    assert balanced.daily_new == 9 and balanced.recommended and balanced.margin_days == 14
    assert intense.daily_new > balanced.daily_new and intense.margin_days > balanced.margin_days


def plan(**kw):
    base = dict(total=995, learned=0, learned_today=0, start=TODAY, target=RAMADAN, today=TODAY, daily_new=9)
    return build_plan(**{**base, **kw})


def test_first_day_is_on_track():
    p = plan()
    assert p.status == "on_track" and p.today_new_target == 9 and p.weekly_new == 63 and p.days_left == 125


def test_behind_gets_a_gentle_catch_up():
    p = plan(today=TODAY + timedelta(days=4), learned=30)
    assert p.status == "behind" and p.delta_verses == -6
    assert p.catchup_extra == 1 and p.catchup_days == 6 and p.today_new_target == 10
    assert "ajoute 1 verset pendant les 6 prochains jours" in p.message
    assert "retard" not in p.headline


def test_ahead_in_days():
    p = plan(today=TODAY + timedelta(days=4), learned=63)
    assert p.status == "ahead" and p.delta_days == 3 and "avance de 3 jours" in p.headline
    assert p.today_new_target == 9


def test_today_never_counts_against_the_user():
    p = plan(today=TODAY + timedelta(days=1), learned=9, learned_today=0)
    assert p.status == "on_track"


def test_projection_follows_real_pace():
    p = plan(today=TODAY + timedelta(days=10), learned=50, recent_daily_avg=5)
    assert p.projected_end == TODAY + timedelta(days=10 + 189)
    assert p.projected_end > RAMADAN


def test_completed():
    p = plan(learned=995)
    assert p.status == "completed" and p.today_new_target == 0
