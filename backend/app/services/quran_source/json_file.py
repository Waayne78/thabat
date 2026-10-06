import json
from dataclasses import asdict
from pathlib import Path

from app.services.quran_source.base import AyahData, QuranDataset, SurahData


class JsonFileSource:
    """Offline source: a normalised dump ({surahs, ayahs, attribution}) — see `dump_dataset`."""

    def __init__(self, path: str):
        self.path = Path(path)

    def load(self) -> QuranDataset:
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        return QuranDataset(
            surahs=[SurahData(**s) for s in raw["surahs"]],
            ayahs=[AyahData(**a) for a in raw["ayahs"]],
            attribution=raw.get("attribution", {}),
        )


def dump_dataset(ds: QuranDataset, path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(asdict(ds), ensure_ascii=False), encoding="utf-8")
