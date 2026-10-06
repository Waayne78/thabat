from datetime import timedelta

API = "/api/v1"
JUZ_30 = {"title": "Juz' ʿAmma", "kind": "scope", "target_date": "2026-10-11", "items": [{"kind": "juz", "ref_id": 30}]}


def make_goal(client, auth, **over):
    r = client.post(f"{API}/goals", json={**JUZ_30, **over}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_goal_is_planned_automatically(client, auth):
    g = make_goal(client, auth)
    assert g["total"] == 15 and g["is_primary"] and g["days_left"] == 5
    assert g["daily_new"] == 4 and g["plan"]["today_new_target"] == 4  # 15 ayahs, 5 days minus buffer
    assert [i["label"] for i in g["items"]] == ["Juz' ʿAmma"]


def test_preview_offers_three_paces(client, auth):
    r = client.post(f"{API}/goals/preview", json={"target_date": "2026-10-21", "items": [{"kind": "juz", "ref_id": 30}, {"kind": "surah", "ref_id": 67}]}, headers=auth)
    body = r.json()
    assert body["total"] == 45 and body["days_left"] == 15 and len(body["options"]) == 3
    assert sum(o["recommended"] for o in body["options"]) == 1


def test_validation(client, auth):
    assert client.post(f"{API}/goals", json={"title": "x", "kind": "scope"}, headers=auth).status_code == 422
    assert client.post(f"{API}/goals", json={**JUZ_30, "target_date": "2020-01-01"}, headers=auth).status_code == 400


def test_daily_loop(client, auth, clock):
    make_goal(client, auth)
    today = client.get(f"{API}/progress/today", headers=auth).json()
    # short surahs first: An-Nas (114) before Al-Falaq, verses in order
    assert [(a["surah_id"], a["number"]) for a in today["new_ayahs"]] == [(114, 1), (114, 2), (114, 3), (114, 4)]
    assert today["reviews"] == [] and today["estimated_minutes"] > 0 and today["plan"]["status"] == "on_track"

    session = client.post(f"{API}/sessions", json={"mode": "daily"}, headers=auth).json()
    ratings = ["easy", "very_easy", "medium", "forgotten"]
    for ayah, rating in zip(today["new_ayahs"], ratings):
        r = client.post(f"{API}/memorization", json={"ayah_id": ayah["id"], "rating": rating, "session_id": session["id"]}, headers=auth)
        assert r.status_code == 201, r.text
    assert r.json()["status"] == "in_progress" and r.json()["newly_learned"] is False
    done = client.post(f"{API}/sessions/{session['id']}/finish", json={"duration_seconds": 420}, headers=auth).json()
    assert done["new_count"] == 3 and done["streak"]["current"] == 1

    after = client.get(f"{API}/progress/today", headers=auth).json()
    assert after["new_done"] == 3 and len(after["new_ayahs"]) == 1  # one still owed today
    assert after["counts"]["learned"] == 3 and after["counts"]["in_progress"] == 1
    assert 0 < after["progress_pct"] < 15  # learned is far from mastered

    unlocked = client.get(f"{API}/achievements", headers=auth).json()
    assert next(a for a in unlocked["achievements"] if a["code"] == "first_verse")["unlocked"]

    # next day: yesterday's verses come back, weakest first
    clock.today += timedelta(days=1)
    nxt = client.get(f"{API}/progress/today", headers=auth).json()
    assert nxt["plan"]["status"] == "behind" and nxt["plan"]["delta_verses"] == -1
    assert nxt["new_target"] == 5
    queue = nxt["reviews"]
    assert [q["ayah"]["number"] for q in queue][0] == 4  # the forgotten one
    assert {q["ayah"]["number"] for q in queue} == {3, 4}  # the easy ones are due later
    r = client.post(f"{API}/reviews", json={"ayah_id": queue[0]["ayah"]["id"], "rating": "easy", "mistakes": 1}, headers=auth).json()
    assert r["mastery_after"] > r["mastery_before"] and r["newly_learned"]

    cal = client.get(f"{API}/progress/calendar", params={"start": "2026-10-05", "end": "2026-10-08"}, headers=auth).json()
    assert [d["status"] for d in cal["days"]] == ["rest", "partial", "partial", "future"]
    assert cal["streak"]["current"] == 2

    stats = client.get(f"{API}/statistics", headers=auth).json()
    assert stats["learned"] == 4 and stats["mastered"] == 0 and stats["seconds"] == 420 and stats["best_streak"] == 2
    assert len(stats["daily"]) == 30 and stats["daily"][-1]["mastery"] is not None

    progress = client.get(f"{API}/progress", headers=auth).json()
    assert [s["id"] for s in progress["surahs"]] == [112, 113, 114]
    assert progress["surahs"][2]["learned"] == 4


def test_missed_day_then_target_date_change(client, auth, clock):
    g = make_goal(client, auth)
    clock.today += timedelta(days=2)
    plan = client.get(f"{API}/progress/today", headers=auth).json()["plan"]
    assert plan["status"] == "behind" and "ajoute" in plan["message"]
    patched = client.patch(f"{API}/goals/{g['id']}", json={"target_date": "2026-11-30"}, headers=auth).json()
    assert patched["plan"]["status"] == "on_track" and patched["daily_new"] == 1


def test_other_goal_kinds_and_soft_delete(client, auth):
    make_goal(client, auth)
    weekly = client.post(f"{API}/goals", json={"title": "50 versets cette semaine", "kind": "weekly", "target_count": 50}, headers=auth).json()
    assert weekly["total"] == 50 and weekly["done"] == 0 and not weekly["is_primary"]
    surah = make_goal(client, auth, title="Al-Mulk avant vendredi", items=[{"kind": "surah", "ref_id": 67}])
    assert surah["total"] == 30 and not surah["is_primary"]
    assert len(client.get(f"{API}/goals", headers=auth).json()) == 3
    assert client.delete(f"{API}/goals/{weekly['id']}", headers=auth).status_code == 204
    assert len(client.get(f"{API}/goals", headers=auth).json()) == 2
    assert client.get(f"{API}/goals/{weekly['id']}", headers=auth).status_code == 404


def test_users_are_isolated(client, auth):
    g = make_goal(client, auth)
    other = client.post(f"{API}/auth/register", json={"email": "b@example.com", "password": "motdepasse123", "display_name": "B"}).json()
    h = {"Authorization": f"Bearer {other['access_token']}"}
    assert client.get(f"{API}/goals", headers=h).json() == []
    assert client.patch(f"{API}/goals/{g['id']}", json={"title": "hack"}, headers=h).status_code == 404


def test_quran_endpoints(client, auth):
    assert len(client.get(f"{API}/surahs", headers=auth).json()) == 4
    s = client.get(f"{API}/surahs/114", headers=auth).json()
    assert len(s["ayahs"]) == 6 and s["ayahs"][0]["audio_url"].endswith("/6231.mp3")
    assert client.get(f"{API}/ayahs/6236", headers=auth).json()["number"] == 6
    assert client.get(f"{API}/ayahs/1", headers=auth).status_code == 404
    assert [j["ayah_count"] for j in client.get(f"{API}/juz", headers=auth).json()] == [30, 15]


def test_reminders(client, auth):
    make_goal(client, auth)
    r = client.post(f"{API}/reminders", json={"kind": "session", "time": "20:30", "days": [0, 2, 4]}, headers=auth)
    assert r.status_code == 201 and r.json()["preview"] == "Il te reste 4 versets aujourd'hui."
    rid = r.json()["id"]
    upd = client.patch(f"{API}/reminders/{rid}", json={"kind": "deadline", "enabled": False}, headers=auth).json()
    assert upd["enabled"] is False and "5 jours de ton objectif" in upd["preview"]
    assert client.delete(f"{API}/reminders/{rid}", headers=auth).status_code == 204
    assert client.get(f"{API}/reminders", headers=auth).json() == []


def test_reminder_worker_sends_at_local_time(client, auth):
    from datetime import datetime, timezone

    from app.database.session import get_db
    from app.main import app
    from app.workers.reminder_worker import run_once

    make_goal(client, auth)
    client.post(f"{API}/reminders", json={"kind": "session", "time": "20:30"}, headers=auth)
    sent: list[str] = []

    class Capture:
        def send(self, user, message):
            sent.append(message)

    db = next(app.dependency_overrides[get_db]())
    at = datetime(2026, 10, 6, 18, 30, tzinfo=timezone.utc)  # 20:30 in Paris
    assert run_once(db, Capture(), at) == 1 and run_once(db, Capture(), at) == 0
    assert run_once(db, Capture(), at.replace(hour=12)) == 0
    assert sent == ["Il te reste 4 versets aujourd'hui."]


def test_already_known_verses(client, auth, clock):
    g = make_goal(client, auth)
    known = [6231, 6232, 6233, 6234, 6235, 6236]  # the whole of surah 114
    r = client.post(f"{API}/memorization/known", json={"ayah_ids": known + [99999], "level": "solid"}, headers=auth)
    assert r.status_code == 201 and r.json() == {"marked": 6, "skipped": 1}
    assert client.post(f"{API}/memorization/known", json={"ayah_ids": known}, headers=auth).json()["marked"] == 0

    today = client.get(f"{API}/progress/today", headers=auth).json()
    # known verses are skipped by the plan, counted as learned but not as mastered, and not as today's work
    assert [(a["surah_id"], a["number"]) for a in today["new_ayahs"]][0] == (113, 1)
    assert today["learned"] == 6 and today["mastered"] == 0 and today["new_done"] == 0
    assert today["plan"]["status"] == "on_track" and today["plan"]["remaining"] == 9
    assert today["reviews"] == []
    clock.today += timedelta(days=1)
    nxt = client.get(f"{API}/progress/today", headers=auth).json()
    assert len(nxt["reviews"]) == 6  # they come back to be verified

    preview = client.post(f"{API}/goals/preview", json={"target_date": "2026-11-30", "items": [{"kind": "surah", "ref_id": 67}], "exclude_ayah_ids": [5242, 5243]}, headers=auth).json()
    assert preview["total"] == 30 and preview["remaining"] == 28
    assert g["total"] == 15
