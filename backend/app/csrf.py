from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import settings

CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "xmlhttprequest"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
EXEMPT_PREFIXES = ("/public/",)
EXEMPT_PATHS = frozenset({"/auth/login", "/auth/refresh", "/"})


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method in SAFE_METHODS or path in EXEMPT_PATHS:
            return await call_next(request)
        if any(path.startswith(prefix) for prefix in EXEMPT_PREFIXES):
            return await call_next(request)

        header = (request.headers.get(CSRF_HEADER) or "").lower()
        if header != CSRF_VALUE:
            return JSONResponse({"detail": "Falha na validação CSRF"}, status_code=403)

        if settings.is_production:
            allowed = [o for o in settings.cors_origins_list() if o != "*"]
            origin = request.headers.get("origin") or ""
            referer = request.headers.get("referer") or ""
            if origin:
                if origin not in allowed:
                    return JSONResponse({"detail": "Origem não permitida"}, status_code=403)
            elif referer:
                if not any(referer.startswith(o) for o in allowed):
                    return JSONResponse({"detail": "Referer não permitido"}, status_code=403)
            else:
                return JSONResponse({"detail": "Origem obrigatória"}, status_code=403)

        return await call_next(request)
