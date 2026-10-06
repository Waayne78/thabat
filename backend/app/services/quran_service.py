from app.core.config import get_settings
from app.models import Ayah
from app.schemas.quran import AyahOut


def ayah_out(a: Ayah, reciter: str | None = None) -> AyahOut:
    s = get_settings()
    return AyahOut(
        id=a.id, surah_id=a.surah_id, surah_name=a.surah.name_translit, surah_name_ar=a.surah.name_ar,
        number=a.number_in_surah, juz=a.juz_id, hizb_quarter=a.hizb_quarter, page=a.page, text_ar=a.text_ar,
        translation=a.text_translation, transliteration=a.text_transliteration,
        audio_url=s.audio_url_template.format(reciter=reciter or s.default_reciter, ayah_id=a.id),
    )
