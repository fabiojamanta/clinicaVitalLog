from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .security import decode_token
from .models import User, UserRole, AuditLog
from .datetime_utils import now_br
import json

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")
    user = db.query(User).filter(User.id == int(payload["sub"]), User.active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")
    return user

def require_roles(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)):
        if user.role not in roles and user.role != UserRole.administrador:
            raise HTTPException(status_code=403, detail="Acesso negado")
        return user
    return checker

def log_action(db: Session, user: User | None, action: str, entity: str, entity_id: int | None, before=None, after=None, request: Request | None = None):
    ip = request.client.host if request and request.client else None
    log = AuditLog(
        clinic_id=user.clinic_id if user else 1,
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        before_data=json.dumps(before, default=str, ensure_ascii=False) if before is not None else None,
        after_data=json.dumps(after, default=str, ensure_ascii=False) if after is not None else None,
        ip_address=ip,
        created_at=now_br(),
    )
    db.add(log)
