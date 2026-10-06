from pydantic import BaseModel

from app.schemas.common import ORMModel


class SurahOut(ORMModel):
    id: int
    name_ar: str
    name_translit: str
    revelation: str
    ayah_count: int
    first_ayah_id: int


class JuzOut(ORMModel):
    id: int
    first_ayah_id: int
    last_ayah_id: int
    ayah_count: int


class AyahOut(BaseModel):
    id: int
    surah_id: int
    surah_name: str
    surah_name_ar: str
    number: int
    juz: int
    hizb_quarter: int
    page: int
    text_ar: str
    translation: str | None
    transliteration: str | None
    audio_url: str


class SurahDetailOut(SurahOut):
    ayahs: list[AyahOut]
