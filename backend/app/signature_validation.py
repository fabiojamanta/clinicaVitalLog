import base64
import re

from fastapi import HTTPException

MAX_SIGNATURE_BYTES = 500 * 1024
_DATA_URL_RE = re.compile(r"^data:image/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$", re.IGNORECASE)


def validate_signature_data_url(data_url: str) -> str:
    raw_input = (data_url or "").strip()
    match = _DATA_URL_RE.match(raw_input)
    if not match:
        raise HTTPException(400, "Assinatura deve ser PNG ou JPEG (data URL válida)")
    fmt = match.group(1).lower()
    b64 = re.sub(r"\s+", "", match.group(2))
    try:
        raw = base64.b64decode(b64, validate=True)
    except Exception as exc:
        raise HTTPException(400, "Assinatura inválida") from exc
    if len(raw) > MAX_SIGNATURE_BYTES:
        raise HTTPException(400, "Assinatura muito grande (máx. 500 KB)")
    if fmt == "png" and not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(400, "Arquivo PNG inválido")
    if fmt in ("jpeg", "jpg") and not raw.startswith(b"\xff\xd8"):
        raise HTTPException(400, "Arquivo JPEG inválido")
    return f"data:image/{fmt};base64,{b64}"
