from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import Login, Token
from ..security import verify_password, create_access_token
from ..deps import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(payload: Login, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email, User.active == True).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    log_action(db, user, "login", "users", user.id, request=request)
    db.commit()
    return {"access_token": token, "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role.value}}
