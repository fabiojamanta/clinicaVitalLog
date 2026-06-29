from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from .database import get_db
from .security import decode_token
from .models import User, AuditLog
from .datetime_utils import now_br
import json

_SENSITIVE_KEYS = frozenset({
    "password", "password_hash", "signature", "patient_signature",
    "prescription", "external_prescription", "notes",
    "email", "phone", "cpf", "cnpj", "document",
})


def _mask_value(key: str, value):
    if key in _SENSITIVE_KEYS:
        return "***"
    if isinstance(value, dict):
        return _mask_data(value)
    if isinstance(value, list):
        return [_mask_data(v) if isinstance(v, dict) else v for v in value]
    return value


def _mask_data(data):
    if data is None:
        return None
    if isinstance(data, dict):
        return {k: _mask_value(k, v) for k, v in data.items()}
    return data


def mask_audit_json(raw: str | None) -> str | None:
    if raw is None:
        return None
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw
    return json.dumps(_mask_data(data), default=str, ensure_ascii=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.id == user_id, User.active == True)
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")
    return user


def log_action(
    db: Session,
    user: User | None,
    action: str,
    entity: str,
    entity_id: int | None,
    before=None,
    after=None,
    request: Request | None = None,
    clinic_id: int | None = None,
):
    ip = request.client.host if request and request.client else None
    log = AuditLog(
        clinic_id=clinic_id or (user.clinic_id if user else 1),
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_data=json.dumps(_mask_data(before), default=str, ensure_ascii=False) if before is not None else None,
        after_data=json.dumps(_mask_data(after), default=str, ensure_ascii=False) if after is not None else None,
        ip_address=ip,
        created_at=now_br(),
    )
    db.add(log)


def log_failed_login(db: Session, email: str, request: Request | None = None):
    ip = request.client.host if request and request.client else None
    masked = email[:2] + "***" if email else "?"
    user = db.query(User).filter(User.email == email).first() if email else None
    clinic_id = user.clinic_id if user else 1
    log = AuditLog(
        clinic_id=clinic_id,
        user_id=None,
        action="login_failed",
        entity="users",
        entity_id=None,
        after_data=json.dumps({"email_hint": masked}, ensure_ascii=False),
        ip_address=ip,
        created_at=now_br(),
    )
    db.add(log)
