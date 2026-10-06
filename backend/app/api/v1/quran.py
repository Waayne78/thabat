from fastapi import APIRouter

from app.api.deps import DB, CurrentUser
from app.core.errors import NotFoundError
from app.repositories import quran_repo
from app.schemas.quran import AyahOut, JuzOut, SurahDetailOut, SurahOut
from app.services.quran_service import ayah_out

router = APIRouter(tags=["quran"])


@router.get("/surahs", response_model=list[SurahOut])
def list_surahs(db: DB, _: CurrentUser):
    return quran_repo.list_surahs(db)


@router.get("/surahs/{surah_id}", response_model=SurahDetailOut)
def get_surah(surah_id: int, db: DB, user: CurrentUser):
    surah = quran_repo.get_surah(db, surah_id)
    if not surah:
        raise NotFoundError("Sourate introuvable.")
    ayahs = [ayah_out(a, user.settings.reciter) for a in quran_repo.ayahs_of_surah(db, surah_id)]
    return SurahDetailOut(**SurahOut.model_validate(surah).model_dump(), ayahs=ayahs)


@router.get("/ayahs/{ayah_id}", response_model=AyahOut)
def get_ayah(ayah_id: int, db: DB, user: CurrentUser):
    ayah = quran_repo.get_ayah(db, ayah_id)
    if not ayah:
        raise NotFoundError("Verset introuvable.")
    return ayah_out(ayah, user.settings.reciter)


@router.get("/juz", response_model=list[JuzOut])
def list_juz(db: DB, _: CurrentUser):
    return quran_repo.list_juz(db)
