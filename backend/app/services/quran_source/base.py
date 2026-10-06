"""Quran data source abstraction.

Business code only knows `QuranDataset`. To switch provider (Tanzil dump, Quran Foundation API,
a licensed in-house file…), add a class implementing `QuranSource` and register it in
`get_quran_source` — nothing else changes. The text itself is never authored in this codebase.
"""
from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class SurahData:
    number: int
    name_ar: str
    name_translit: str
    revelation: str
    ayah_count: int


@dataclass
class AyahData:
    number: int  # global 1..6236
    surah: int
    number_in_surah: int
    juz: int
    hizb_quarter: int
    page: int
    text_ar: str
    text_translation: str | None = None
    text_transliteration: str | None = None


@dataclass
class QuranDataset:
    surahs: list[SurahData] = field(default_factory=list)
    ayahs: list[AyahData] = field(default_factory=list)
    attribution: dict[str, str] = field(default_factory=dict)


class QuranSource(Protocol):
    def load(self) -> QuranDataset: ...
