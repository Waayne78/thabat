from app.core.config import Settings
from app.services.quran_source.alquran_cloud import AlQuranCloudSource
from app.services.quran_source.base import AyahData, QuranDataset, QuranSource, SurahData
from app.services.quran_source.json_file import JsonFileSource

__all__ = ["AyahData", "QuranDataset", "QuranSource", "SurahData", "get_quran_source"]


def get_quran_source(settings: Settings) -> QuranSource:
    if settings.quran_source == "json_file":
        return JsonFileSource(settings.quran_json_path)
    if settings.quran_source == "alquran_cloud":
        return AlQuranCloudSource(
            settings.quran_api_base, settings.quran_arabic_edition,
            settings.quran_translation_edition or None, settings.quran_transliteration_edition or None,
        )
    raise ValueError(f"Unknown QURAN_SOURCE: {settings.quran_source}")
