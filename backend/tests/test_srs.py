from datetime import date, timedelta

from app.services.srs import CardState, Rating, apply_rating, effective_mastery, review_priority

D = date(2026, 10, 6)


def test_one_good_recitation_is_not_mastery():
    out = apply_rating(CardState(), Rating.very_easy, D)
    assert out.status == "learned"
    assert out.state.mastery < 60


def test_mastery_needs_several_spaced_successes():
    state, day, n = CardState(), D, 0
    status = ""
    while status != "mastered":
        out = apply_rating(state, Rating.easy, day)
        state, day, status, n = out.state, out.due_date, out.status, n + 1
        assert n < 12
    assert n >= 4
    assert state.mastery >= 85


def test_forgetting_drops_mastery_and_resets_schedule():
    strong = CardState(mastery=90, ease=2.5, interval_days=20, repetitions=5)
    out = apply_rating(strong, Rating.forgotten, D)
    assert out.state.mastery < 50
    assert out.state.interval_days == 1 and out.state.repetitions == 0 and out.state.lapses == 1
    assert out.status != "mastered"


def test_weak_first_attempt_stays_in_progress():
    assert apply_rating(CardState(), Rating.forgotten, D).status == "in_progress"
    assert apply_rating(CardState(), Rating.hard, D).status == "in_progress"


def test_intervals_grow_and_are_capped_near_the_deadline():
    s = CardState(mastery=80, ease=2.5, interval_days=20, repetitions=4)
    assert apply_rating(s, Rating.easy, D).state.interval_days > 20
    assert apply_rating(s, Rating.easy, D, days_to_target=12).state.interval_days == 4


def test_mistakes_lower_the_score():
    s = CardState(mastery=60, repetitions=2, interval_days=4)
    assert apply_rating(s, Rating.medium, D, mistakes=3).state.mastery < apply_rating(s, Rating.medium, D).state.mastery


def test_overdue_reviews_fade_and_rank_first():
    assert effective_mastery(80, D - timedelta(days=10), D) == 64
    assert effective_mastery(80, D + timedelta(days=1), D) == 80
    late = review_priority(mastery=70, lapses=0, due_date=D - timedelta(days=6), today=D)
    fresh = review_priority(mastery=70, lapses=0, due_date=D, today=D)
    weak = review_priority(mastery=30, lapses=2, due_date=D, today=D)
    assert late > fresh and weak > fresh
