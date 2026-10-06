import os
from datetime import date

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_today
from app.database.base import Base
from app.database.seed_quran import load_dataset
from app.database.session import get_db
from app.main import app
from app.services.quran_source import AyahData, QuranDataset, SurahData

TODAY = date(2026, 10, 6)


def fake_dataset() -> QuranDataset:
    """Structure of a few real surahs with placeholder text — tests never embed Quranic text."""
    ds = QuranDataset()
    for number, name, count, first, juz in [(67, "Al-Mulk", 30, 5242, 29), (112, "Al-Ikhlaas", 4, 6222, 30),
                                             (113, "Al-Falaq", 5, 6226, 30), (114, "An-Naas", 6, 6231, 30)]:
        ds.surahs.append(SurahData(number, name, name, "meccan", count))
        for n in range(count):
            ds.ayahs.append(AyahData(first + n, number, n + 1, juz, 1, 600, f"[{number}:{n + 1}] mot1 mot2 mot3", f"fr {number}:{n + 1}"))
    return ds


class Clock:
    today = TODAY


@pytest.fixture()
def clock():
    Clock.today = TODAY
    return Clock


@pytest.fixture()
def client(clock):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    with Session() as db:
        load_dataset(db, fake_dataset())

    def _db():
        with Session() as db:
            yield db

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_today] = lambda: clock.today
    c = TestClient(app, base_url="http://testserver")
    yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth(client):
    r = client.post("/api/v1/auth/register", json={"email": "milane@example.com", "password": "motdepasse123", "display_name": "Milane"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
