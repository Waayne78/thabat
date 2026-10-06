import re
import unicodedata

import httpx

from app.services.quran_source.base import AyahData, QuranDataset, SurahData

_TAGS = re.compile(r"<[^>]+>")


def _skeleton(word: str) -> str:
    """Letters only (diacritics removed) — used to compare spellings, never to alter stored text."""
    return "".join(c for c in unicodedata.normalize("NFD", word) if unicodedata.category(c) not in ("Mn", "Cf"))


def strip_leading_basmala(text: str, basmala: str) -> str:
    """Removes a leading basmala whose vocalisation may differ slightly from 1:1 in this edition."""
    ref, words = basmala.split(), text.split()
    if len(words) > len(ref) and all(_skeleton(a) == _skeleton(b) for a, b in zip(words, ref)):
        return " ".join(words[len(ref):])
    return text


class AlQuranCloudSource:
    """api.alquran.cloud — Arabic text is the Tanzil Uthmani edition (CC BY 3.0, verbatim)."""

    def __init__(self, base_url: str, arabic: str, translation: str | None, transliteration: str | None):
        self.base_url = base_url.rstrip("/")
        self.arabic = arabic
        self.translation = translation
        self.transliteration = transliteration

    def _fetch(self, client: httpx.Client, edition: str) -> list[dict]:
        r = client.get(f"{self.base_url}/quran/{edition}")
        r.raise_for_status()
        return r.json()["data"]["surahs"]

    def load(self) -> QuranDataset:
        with httpx.Client(timeout=120) as client:
            arabic = self._fetch(client, self.arabic)
            translation = self._texts(self._fetch(client, self.translation)) if self.translation else {}
            translit = self._texts(self._fetch(client, self.transliteration)) if self.transliteration else {}

        ds = QuranDataset(
            attribution={
                "arabic": f"{self.arabic} — Tanzil Project (tanzil.net), CC BY 3.0, via api.alquran.cloud",
                "translation": f"{self.translation} via api.alquran.cloud" if self.translation else "",
                "transliteration": f"{self.transliteration} via api.alquran.cloud" if self.transliteration else "",
            }
        )
        # This edition prepends the basmala to the first ayah of each surah. It is not part of that
        # ayah (except in Al-Fatiha), so we remove it by comparing with 1:1 from the same dataset.
        basmala = arabic[0]["ayahs"][0]["text"].strip()
        for s in arabic:
            ds.surahs.append(
                SurahData(
                    number=s["number"], name_ar=s["name"], name_translit=s["englishName"],
                    revelation="meccan" if s["revelationType"] == "Meccan" else "medinan", ayah_count=len(s["ayahs"]),
                )
            )
            for a in s["ayahs"]:
                text = a["text"].strip().lstrip("﻿")
                if a["numberInSurah"] == 1 and s["number"] not in (1, 9):
                    text = strip_leading_basmala(text, basmala)
                ds.ayahs.append(
                    AyahData(
                        number=a["number"], surah=s["number"], number_in_surah=a["numberInSurah"], juz=a["juz"],
                        hizb_quarter=a["hizbQuarter"], page=a["page"], text_ar=text,
                        text_translation=translation.get(a["number"]),
                        text_transliteration=translit.get(a["number"]),
                    )
                )
        return ds

    @staticmethod
    def _texts(surahs: list[dict]) -> dict[int, str]:
        return {a["number"]: _TAGS.sub("", a["text"]).strip() for s in surahs for a in s["ayahs"]}
