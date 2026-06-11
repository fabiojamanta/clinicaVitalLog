from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from ..database import get_db
from ..models import Supplier, Client, Product, Lot, User, Profile, AccessLevel
from ..schemas import SupplierCreate, SupplierRead, ClientCreate, ClientRead, ProductCreate, ProductRead, LotRead, UserCreate, UserUpdate, UserRead
from ..deps import get_current_user, log_action
from ..permissions import require_menu_access, require_admin, assert_menu_access, assert_any_menu_access
from ..security import get_password_hash, validate_password_strength
from ..tenant import assert_supplier_in_clinic
from datetime import date, timedelta
from ..datetime_utils import today_br
from ..format_utils import digits_only

router = APIRouter(tags=["cadastros"])


def _normalize_contact_fields(data: dict) -> dict:
    if "document" in data:
        data["document"] = digits_only(data.get("document"))
    if "phone" in data:
        data["phone"] = digits_only(data.get("phone"))
    for text_field in ("address", "city", "responsible_name", "email", "notes"):
        if text_field in data and data[text_field] is not None:
            data[text_field] = data[text_field].strip() or None
    if "state" in data:
        uf = (data.get("state") or "").strip().upper()
        data["state"] = uf[:2] if uf else None
    return data

def _normalize_user_fields(data: dict) -> dict:
    if "phone" in data:
        data["phone"] = digits_only(data.get("phone"))
    return data


def _user_to_read(u: User) -> UserRead:
    return UserRead(
        id=u.id,
        clinic_id=u.clinic_id,
        name=u.name,
        email=u.email,
        phone=u.phone,
        profile_id=u.profile_id,
        active=u.active,
        profile_name=u.profile.name if u.profile else None,
        created_at=u.created_at,
    )


def _get_profile(db: Session, clinic_id: int, profile_id: int) -> Profile:
    p = db.query(Profile).filter_by(id=profile_id, clinic_id=clinic_id, active=True).first()
    if not p:
        raise HTTPException(400, "Perfil inválido ou inativo")
    return p

# Usuários
@router.get("/users", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("usuarios", AccessLevel.read)),
):
    rows = (
        db.query(User)
        .options(joinedload(User.profile))
        .filter(User.clinic_id == user.clinic_id)
        .order_by(User.name)
        .all()
    )
    return [_user_to_read(r) for r in rows]

@router.post("/users", response_model=UserRead)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("usuarios", AccessLevel.write)),
):
    if db.query(User).filter(User.clinic_id == user.clinic_id, User.email == payload.email).first():
        raise HTTPException(400, "Email já cadastrado")
    validate_password_strength(payload.password)
    data = _normalize_user_fields(payload.model_dump())
    profile = _get_profile(db, user.clinic_id, payload.profile_id)
    obj = User(
        clinic_id=user.clinic_id,
        profile_id=profile.id,
        name=data["name"],
        email=data["email"],
        phone=data.get("phone"),
        password_hash=get_password_hash(payload.password),
        active=payload.active,
    )
    db.add(obj); db.flush()
    log_action(db, user, "create", "users", obj.id, after={
        "name": obj.name, "email": obj.email, "phone": obj.phone, "profile_id": obj.profile_id,
    }, request=request)
    db.commit()
    db.refresh(obj)
    obj.profile = profile
    return _user_to_read(obj)

@router.put("/users/{id}", response_model=UserRead)
def update_user(
    id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("usuarios", AccessLevel.write)),
):
    obj = db.query(User).options(joinedload(User.profile)).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj:
        raise HTTPException(404, "Usuário não encontrado")
    other = db.query(User).filter(
        User.clinic_id == user.clinic_id,
        User.email == payload.email,
        User.id != id,
    ).first()
    if other:
        raise HTTPException(400, "Email já cadastrado")
    before = {c.name: getattr(obj, c.name) for c in obj.__table__.columns if c.name != "password_hash"}
    data = _normalize_user_fields(payload.model_dump())
    profile = _get_profile(db, user.clinic_id, payload.profile_id)
    obj.name = data["name"]
    obj.email = data["email"]
    obj.phone = data.get("phone")
    obj.profile_id = profile.id
    obj.active = payload.active
    if payload.password and payload.password.strip():
        validate_password_strength(payload.password)
        obj.password_hash = get_password_hash(payload.password)
    after = {
        "name": obj.name,
        "email": obj.email,
        "phone": obj.phone,
        "profile_id": obj.profile_id,
        "active": obj.active,
        "password_changed": bool(payload.password and payload.password.strip()),
    }
    log_action(db, user, "update", "users", obj.id, before=before, after=after, request=request)
    db.commit()
    db.refresh(obj)
    obj.profile = profile
    return _user_to_read(obj)

SUPPLIER_LOOKUP_MENUS = ("fornecedores", "produtos", "relatorios")
CLIENT_LOOKUP_MENUS = ("clientes", "atendimentos", "atendimentos_pendentes", "reservas", "saidas", "relatorios")
PRODUCT_LOOKUP_MENUS = ("produtos", "entradas", "saidas", "atendimentos", "relatorios")


# Fornecedores
@router.get("/suppliers", response_model=list[SupplierRead])
def list_suppliers(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if q and len(q.strip()) >= 3:
        assert_any_menu_access(db, user, SUPPLIER_LOOKUP_MENUS, AccessLevel.read)
    else:
        assert_menu_access(db, user, "fornecedores", AccessLevel.read)
    query = db.query(Supplier).filter(Supplier.clinic_id == user.clinic_id)
    if q and len(q.strip()) >= 3:
        query = query.filter(Supplier.name.ilike(f"%{q.strip()}%")).order_by(Supplier.name).limit(50)
    else:
        query = query.order_by(Supplier.name)
    return query.all()

@router.post("/suppliers", response_model=SupplierRead)
def create_supplier(payload: SupplierCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("fornecedores", AccessLevel.write))):
    data = _normalize_contact_fields(payload.model_dump())
    obj = Supplier(clinic_id=user.clinic_id, **data)
    db.add(obj); db.flush()
    log_action(db, user, "create", "suppliers", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    return obj

@router.put("/suppliers/{id}", response_model=SupplierRead)
def update_supplier(id: int, payload: SupplierCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("fornecedores", AccessLevel.write))):
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
def list_clients(
    q: Optional[str] = None,
    client_type: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if q and len(q.strip()) >= 3:
        assert_any_menu_access(db, user, CLIENT_LOOKUP_MENUS, AccessLevel.read)
    else:
        assert_menu_access(db, user, "clientes", AccessLevel.read)
    query = db.query(Client).filter(Client.clinic_id == user.clinic_id)
    if client_type:
        query = query.filter(Client.client_type == client_type)
    if active_only:
        query = query.filter(Client.active == True)
    if q and len(q.strip()) >= 3:
        query = query.filter(Client.name.ilike(f"%{q.strip()}%")).order_by(Client.name).limit(50)
    else:
        query = query.order_by(Client.name)
    return query.all()

@router.post("/clients", response_model=ClientRead)
def create_client(payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("clientes", AccessLevel.write))):
    data = _normalize_contact_fields(payload.model_dump())
    obj = Client(clinic_id=user.clinic_id, **data)
    db.add(obj); db.flush()
    log_action(db, user, "create", "clients", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    return obj

@router.put("/clients/{id}", response_model=ClientRead)
def update_client(id: int, payload: ClientCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("clientes", AccessLevel.write))):
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
def list_products(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if q and len(q.strip()) >= 3:
        assert_any_menu_access(db, user, PRODUCT_LOOKUP_MENUS, AccessLevel.read)
    else:
        assert_menu_access(db, user, "produtos", AccessLevel.read)
    query = db.query(Product).filter(Product.clinic_id == user.clinic_id)
    if q and len(q.strip()) >= 3:
        query = query.filter(Product.name.ilike(f"%{q.strip()}%")).order_by(Product.name).limit(50)
    else:
        query = query.order_by(Product.name)
    products = query.all()
    result = []
    for p in products:
        total = db.query(func.coalesce(func.sum(Lot.current_stock), 0)).filter(Lot.product_id == p.id, Lot.active == True).scalar() or 0
        data = ProductRead.model_validate(p)
        data.total_stock = int(total)
        data.supplier_name = p.supplier.name if p.supplier else None
        result.append(data)
    return result

@router.post("/products", response_model=ProductRead)
def create_product(payload: ProductCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("produtos", AccessLevel.write))):
    assert_supplier_in_clinic(db, payload.supplier_id, user.clinic_id)
    obj = Product(clinic_id=user.clinic_id, **payload.model_dump())
    db.add(obj); db.flush()
    log_action(db, user, "create", "products", obj.id, after=payload.model_dump(), request=request)
    db.commit(); db.refresh(obj)
    out = ProductRead.model_validate(obj); out.total_stock = 0
    out.supplier_name = obj.supplier.name if obj.supplier else None
    return out

@router.put("/products/{id}", response_model=ProductRead)
def update_product(id: int, payload: ProductCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_menu_access("produtos", AccessLevel.write))):
    obj = db.query(Product).filter_by(id=id, clinic_id=user.clinic_id).first()
    if not obj: raise HTTPException(404, "Produto não encontrado")
    assert_supplier_in_clinic(db, payload.supplier_id, user.clinic_id)
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
    user: User = Depends(require_menu_access("produtos", AccessLevel.read)),
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
