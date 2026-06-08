from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Supplier, Client, Product, Lot, User, UserRole
from ..schemas import SupplierCreate, SupplierRead, ClientCreate, ClientRead, ProductCreate, ProductRead, LotRead, UserCreate, UserUpdate, UserRead
from ..deps import get_current_user, require_roles, log_action
from ..security import get_password_hash
from datetime import date, timedelta
from ..datetime_utils import today_br
from ..format_utils import digits_only

router = APIRouter(tags=["cadastros"])


def _normalize_contact_fields(data: dict) -> dict:
    if "document" in data:
        data["document"] = digits_only(data.get("document"))
    if "phone" in data:
        data["phone"] = digits_only(data.get("phone"))
    return data

# Usuários
@router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador))):
    return db.query(User).filter(User.clinic_id == user.clinic_id).order_by(User.name).all()

@router.post("/users", response_model=UserRead)
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador))):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Email já cadastrado")
    obj = User(clinic_id=user.clinic_id, name=payload.name, email=payload.email, password_hash=get_password_hash(payload.password), role=payload.role, active=payload.active)
    db.add(obj); db.flush()
    log_action(db, user, "create", "users", obj.id, after={"name": obj.name, "email": obj.email, "role": obj.role.value}, request=request)
    db.commit(); db.refresh(obj)
    return obj

@router.put("/users/{id}", response_model=UserRead)
def update_user(
    id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.administrador)),
):
    obj = db.query(User).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj:
        raise HTTPException(404, "Usuário não encontrado")
    other = db.query(User).filter(User.email == payload.email, User.id != id).first()
    if other:
        raise HTTPException(400, "Email já cadastrado")
    before = {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name != "password_hash"}
    obj.name = payload.name
    obj.email = payload.email
    obj.role = payload.role
    obj.active = payload.active
    if payload.password and payload.password.strip():
        obj.password_hash = get_password_hash(payload.password)
    after = {
        "name": obj.name,
        "email": obj.email,
        "role": obj.role.value,
        "active": obj.active,
        "password_changed": bool(payload.password and payload.password.strip()),
    }
    log_action(db, user, "update", "users", obj.id, before=before, after=after, request=request)
    db.commit()
    db.refresh(obj)
    return obj

# Fornecedores
@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Supplier).filter(Supplier.clinic_id == user.clinic_id).order_by(Supplier.name).all()

@router.post("/suppliers", response_model=SupplierRead)
def create_supplier(payload: SupplierCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    data = _normalize_contact_fields(payload.model_dump())
    obj = Supplier(clinic_id=user.clinic_id, **data)
    db.add(obj); db.flush()
    log_action(db, user, "create", "suppliers", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    return obj

@router.put("/suppliers/{id}", response_model=SupplierRead)
def update_supplier(id: int, payload: SupplierCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    obj = db.query(Supplier).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj: raise HTTPException(404, "Fornecedor não encontrado")
    before = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    data = _normalize_contact_fields(payload.model_dump())
    for k, v in data.items():
        setattr(obj, k, v)
    log_action(db, user, "update", "suppliers", obj.id, before=before, after=data, request=request)
    db.commit(); db.refresh(obj)
    return obj

# Clientes
@router.get("/clients", response_model=list[ClientRead])
def list_clients(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Client).filter(Client.clinic_id == user.clinic_id).order_by(Client.name).all()

@router.post("/clients", response_model=ClientRead)
def create_client(payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque, UserRole.operacional))):
    data = _normalize_contact_fields(payload.model_dump())
    obj = Client(clinic_id=user.clinic_id, **data)
    db.add(obj); db.flush()
    log_action(db, user, "create", "clients", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    return obj

@router.put("/clients/{id}", response_model=ClientRead)
def update_client(id: int, payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    obj = db.query(Client).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj: raise HTTPException(404, "Cliente não encontrado")
    before = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    data = _normalize_contact_fields(payload.model_dump())
    for k, v in data.items():
        setattr(obj, k, v)
    log_action(db, user, "update", "clients", obj.id, before=before, after=data, request=request)
    db.commit(); db.refresh(obj)
    return obj

# Produtos
@router.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    products = db.query(Product).filter(Product.clinic_id == user.clinic_id).order_by(Product.name).all()
    result = []
    for p in products:
        total = db.query(func.coalesce(func.sum(Lot.current_stock), 0)).filter(Lot.product_id == p.id, Lot.active == True).scalar() or 0
        data = ProductRead.model_validate(p)
        data.total_stock = int(total)
        data.supplier_name = p.supplier.name if p.supplier else None
        result.append(data)
    return result

@router.post("/products", response_model=ProductRead)
def create_product(payload: ProductCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    obj = Product(clinic_id=user.clinic_id, **payload.model_dump())
    db.add(obj); db.flush()
    log_action(db, user, "create", "products", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    out = ProductRead.model_validate(obj); out.total_stock = 0
    out.supplier_name = obj.supplier.name if obj.supplier else None
    return out

@router.put("/products/{id}", response_model=ProductRead)
def update_product(id: int, payload: ProductCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    obj = db.query(Product).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj: raise HTTPException(404, "Produto não encontrado")
    before = {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    for k,v in payload.model_dump().items(): setattr(obj,k,v)
    log_action(db, user, "update", "products", obj.id, before=before, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    out = ProductRead.model_validate(obj)
    out.total_stock = int(db.query(func.coalesce(func.sum(Lot.current_stock), 0)).filter(Lot.product_id == obj.id, Lot.active == True).scalar() or 0)
    out.supplier_name = obj.supplier.name if obj.supplier else None
    return out

# Lotes
@router.get("/lots", response_model=list[LotRead])
def list_lots(
    include_expired: bool = False,
    expired_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.query(Lot).filter(Lot.clinic_id == user.clinic_id, Lot.active == True).order_by(Lot.expiration_date).all()
    today = today_br()
    out = []
    for r in rows:
        if r.current_stock <= 0:
            continue
        expired = r.expiration_date < today
        if expired_only:
            if not expired:
                continue
        elif not include_expired and expired:
            continue
        days = r.product.expiration_alert_days if r.product else 30
        out.append(LotRead(
            id=r.id, product_id=r.product_id, supplier_id=r.supplier_id,
            lot_number=r.lot_number, expiration_date=r.expiration_date,
            current_stock=r.current_stock, quantity_in_use=r.quantity_in_use,
            blocked=r.blocked, active=r.active,
            product_name=r.product.name, supplier_name=r.supplier.name,
            expired=expired, near_expiration=r.expiration_date <= today + timedelta(days=days),
        ))
    return out
