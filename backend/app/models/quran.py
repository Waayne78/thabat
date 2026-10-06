from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class Surah(Base):
    __tablename__ = "surahs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)  # 1..114
    name_ar: Mapped[str] = mapped_column(String(80))
    name_translit: Mapped[str] = mapped_column(String(80))
    revelation: Mapped[str] = mapped_column(String(10))  # meccan | medinan
    ayah_count: Mapped[int] = mapped_column(Integer)
    first_ayah_id: Mapped[int] = mapped_column(Integer)

    ayahs: Mapped[list["Ayah"]] = relationship(back_populates="surah", order_by="Ayah.id")


class Juz(Base):
    __tablename__ = "juz"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)  # 1..30
    first_ayah_id: Mapped[int] = mapped_column(Integer)
    last_ayah_id: Mapped[int] = mapped_column(Integer)
    ayah_count: Mapped[int] = mapped_column(Integer)


class Ayah(Base):
    __tablename__ = "ayahs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)  # global number 1..6236
    surah_id: Mapped[int] = mapped_column(ForeignKey("surahs.id"), index=True)
    number_in_surah: Mapped[int] = mapped_column(Integer)
    juz_id: Mapped[int] = mapped_column(ForeignKey("juz.id"), index=True)
    hizb_quarter: Mapped[int] = mapped_column(Integer)
    page: Mapped[int] = mapped_column(Integer)
    text_ar: Mapped[str] = mapped_column(Text)
    text_translation: Mapped[str | None] = mapped_column(Text, default=None)
    text_transliteration: Mapped[str | None] = mapped_column(Text, default=None)

    surah: Mapped[Surah] = relationship(back_populates="ayahs")
