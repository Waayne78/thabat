from fastapi import APIRouter

from app.api.v1 import auth, goals, progress, quran, reminders

api_router = APIRouter(prefix="/api/v1")
for module in (auth, quran, goals, progress, reminders):
    api_router.include_router(module.router)
