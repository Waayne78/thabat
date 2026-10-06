from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    status_code = 409
    code = "conflict"


class UnauthorizedError(AppError):
    status_code = 401
    code = "unauthorized"


class RateLimitError(AppError):
    status_code = 429
    code = "rate_limited"


def _french(err: dict) -> str:
    kind, ctx, field = err["type"], err.get("ctx") or {}, str(err["loc"][-1])
    if kind == "missing":
        return "Ce champ est requis."
    if kind == "string_too_short":
        return f"Trop court : {ctx.get('min_length')} caractères minimum."
    if kind == "string_too_long":
        return f"Trop long : {ctx.get('max_length')} caractères maximum."
    if field == "email":
        return "Cette adresse e-mail n'est pas valide."
    if kind in ("greater_than_equal", "less_than_equal", "int_parsing"):
        return "Cette valeur est hors des limites autorisées."
    return err["msg"].removeprefix("Value error, ").capitalize()


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": _french(e)} for e in exc.errors()]
        return JSONResponse(
            status_code=422,
            content={"error": {"code": "validation_error", "message": "Certains champs sont invalides.", "fields": fields}},
        )
