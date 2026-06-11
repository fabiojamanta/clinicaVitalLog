from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session, joinedload

from ..auth_cookies import clear_auth_cookies, set_auth_cookies
from ..database import get_db
from ..deps import get_current_user, log_action, log_failed_login
from ..models import User
from ..permissions import get_user_permissions, profile_to_dict
from ..rate_limit import limiter
from ..schemas import Login, Token
from ..security import (
    create_access_token,
    generate_refresh_token_plain,
    get_password_hash,
    revoke_all_user_refresh_tokens,
    store_refresh_token,
    validate_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_payload(user: User, db: Session) -> dict:
    perms = get_user_permissions(db, user)
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "profile": profile_to_dict(user.profile) if user.profile else None,
        "permissions": perms,
    }


@router.post("/login", response_model=Token)
@limiter.limit("30/minute")
def login(payload: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.email == payload.email, User.active == True)
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        log_failed_login(db, payload.email, request=request)
        db.commit()
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    access = create_access_token({"sub": str(user.id), "profile_id": str(user.profile_id)})
    refresh_plain = generate_refresh_token_plain()
    revoke_all_user_refresh_tokens(db, user.id)
    store_refresh_token(db, user.id, refresh_plain)
    set_auth_cookies(response, access, refresh_plain)
    log_action(db, user, "login", "users", user.id, request=request)
    db.commit()
    return {
        "access_token": access,
        "token_type": "bearer",
        "user": _user_payload(user, db),
    }


@router.post("/refresh")
@limiter.limit("60/minute")
def refresh_session(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_plain = request.cookies.get("refresh_token")
    if not refresh_plain:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    validated = validate_refresh_token(db, refresh_plain)
    if not validated:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    user = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.id == validated.id, User.active == True)
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado ou inativo")
    access = create_access_token({"sub": str(user.id), "profile_id": str(user.profile_id)})
    new_refresh = generate_refresh_token_plain()
    store_refresh_token(db, user.id, new_refresh)
    set_auth_cookies(response, access, new_refresh)
    db.commit()
    return {"ok": True, "access_token": access, "user": _user_payload(user, db)}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    refresh_plain = request.cookies.get("refresh_token")
    if refresh_plain:
        from ..security import revoke_refresh_token
        revoke_refresh_token(db, refresh_plain)
    revoke_all_user_refresh_tokens(db, user.id)
    clear_auth_cookies(response)
    log_action(db, user, "logout", "users", user.id, request=request)
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_payload(user, db)
