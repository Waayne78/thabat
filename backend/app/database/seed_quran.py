"""Load the Quran reference tables from the configured source.

    python -m app.database.seed_quran            # idempotent
    python -m app.database.seed_quran --dump data/quran.json   # also write an offline copy
"""
import argparse
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.base import Base
from app.models import Ayah, Juz, Surah
from app.services.quran_source import QuranDataset, get_quran_source
from app.services.quran_source.json_file import dump_dataset


def load_dataset(db: Session, ds: QuranDataset) -> int:
    first_by_surah: dict[int, int] = {}
    by_juz: dict[int, list[int]] = defaultdict(list)
    for a in ds.ayahs:
        first_by_surah.setdefault(a.surah, a.number)
        by_juz[a.juz].append(a.number)
    db.add_all(
        Surah(
            id=s.number, name_ar=s.name_ar, name_translit=s.name_translit, revelation=s.revelation,
            ayah_count=s.ayah_count, first_ayah_id=first_by_surah[s.number],
        )
        for s in ds.surahs
    )
    db.add_all(Juz(id=j, first_ayah_id=min(ids), last_ayah_id=max(ids), ayah_count=len(ids)) for j, ids in by_juz.items())
    db.flush()
    db.add_all(
        Ayah(
            id=a.number, surah_id=a.surah, number_in_surah=a.number_in_surah, juz_id=a.juz,
            hizb_quarter=a.hizb_quarter, page=a.page, text_ar=a.text_ar,
            text_translation=a.text_translation, text_transliteration=a.text_transliteration,
        )
        for a in ds.ayahs
    )
    db.commit()
    return len(ds.ayahs)


def main() -> None:
    from app.database.session import SessionLocal, engine

    parser = argparse.ArgumentParser()
    parser.add_argument("--dump", help="write the normalised dataset to this JSON file")
    args = parser.parse_args()

    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(Ayah)) or 0
        if existing and not args.dump:
            print(f"Quran already loaded ({existing} ayahs) — nothing to do.")
            return
        ds = get_quran_source(get_settings()).load()
        if args.dump:
            dump_dataset(ds, args.dump)
            print(f"Dataset written to {args.dump}")
        if not existing:
            print(f"Loaded {load_dataset(db, ds)} ayahs / {len(ds.surahs)} surahs.")


if __name__ == "__main__":
    main()
