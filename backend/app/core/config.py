from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Thabāt"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://thabat:thabat@localhost:5432/thabat"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cookie_secure: bool = False

    cors_origins: str = "http://localhost:5173"
    rate_limit_enabled: bool = True
    auth_rate_limit_per_minute: int = 10

    # Quran data source — swap without touching business code (see services/quran_source).
    quran_source: str = "alquran_cloud"  # alquran_cloud | json_file
    quran_json_path: str = "data/quran.json"
    quran_api_base: str = "https://api.alquran.cloud/v1"
    quran_arabic_edition: str = "quran-uthmani"
    quran_translation_edition: str = "fr.hamidullah"
    quran_transliteration_edition: str = "en.transliteration"
    audio_url_template: str = "https://cdn.islamic.network/quran/audio/128/{reciter}/{ayah_id}.mp3"
    default_reciter: str = "ar.alafasy"

    default_timezone: str = "Europe/Paris"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
