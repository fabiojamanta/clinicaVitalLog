import secrets

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from .database import Base, engine, SessionLocal
from .models import Clinic, User, Client, ClientType, StockEntry, Profile
from .entry_code import generate_entry_code
from .config import settings
from sqlalchemy import text
from .security import get_password_hash, validate_password_strength
from .routers import auth, crud, stock, reports, attendances, treatments, bookings, permissions
from .profile_seed import seed_profiles, sync_menu_catalog
from .user_migration import migrate_users_table
from .middleware import SecurityHeadersMiddleware
from .csrf import CsrfMiddleware
from .rate_limit import limiter

Base.metadata.create_all(bind=engine)

def migrate_sqlite():
    try:
        with engine.begin() as conn:
            cols = conn.execute(text("PRAGMA table_info('products')")).fetchall()
            col_names = {c[1] for c in cols}
            if "supplier_id" not in col_names:
                conn.execute(text("ALTER TABLE products ADD COLUMN supplier_id INTEGER"))
            if "barcode" not in col_names:
                conn.execute(text("ALTER TABLE products ADD COLUMN barcode VARCHAR(80)"))

            entry_cols = {c[1] for c in conn.execute(text("PRAGMA table_info('stock_entries')")).fetchall()}
            if "entry_code" not in entry_cols:
                conn.execute(text("ALTER TABLE stock_entries ADD COLUMN entry_code VARCHAR(32)"))
            if "status" not in entry_cols:
                conn.execute(text("ALTER TABLE stock_entries ADD COLUMN status VARCHAR(20) DEFAULT 'ativa'"))
            if "cancel_reason" not in entry_cols:
                conn.execute(text("ALTER TABLE stock_entries ADD COLUMN cancel_reason TEXT"))

            exit_cols = {c[1] for c in conn.execute(text("PRAGMA table_info('stock_exits')")).fetchall()}
            if "exit_type" not in exit_cols:
                conn.execute(text("ALTER TABLE stock_exits ADD COLUMN exit_type VARCHAR(20) DEFAULT 'consumo'"))
            if "attendance_id" not in exit_cols:
                conn.execute(text("ALTER TABLE stock_exits ADD COLUMN attendance_id INTEGER"))
            if "treatment_session_id" not in exit_cols:
                conn.execute(text("ALTER TABLE stock_exits ADD COLUMN treatment_session_id INTEGER"))

            user_cols = {c[1] for c in conn.execute(text("PRAGMA table_info('users')")).fetchall()}
            if "phone" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(40)"))
            if "profile_id" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN profile_id INTEGER"))

            client_cols = {c[1] for c in conn.execute(text("PRAGMA table_info('clients')")).fetchall()}
            if "address" not in client_cols:
                conn.execute(text("ALTER TABLE clients ADD COLUMN address VARCHAR(255)"))
            if "city" not in client_cols:
                conn.execute(text("ALTER TABLE clients ADD COLUMN city VARCHAR(120)"))
            if "responsible_name" not in client_cols:
                conn.execute(text("ALTER TABLE clients ADD COLUMN responsible_name VARCHAR(180)"))
            if "state" not in client_cols:
                conn.execute(text("ALTER TABLE clients ADD COLUMN state VARCHAR(2)"))

            att_cols = {c[1] for c in conn.execute(text("PRAGMA table_info('attendances')")).fetchall()}
            if "booking_id" not in att_cols:
                conn.execute(text("ALTER TABLE attendances ADD COLUMN booking_id INTEGER"))
            if "external_prescription" not in att_cols:
                conn.execute(text("ALTER TABLE attendances ADD COLUMN external_prescription TEXT"))
            if "vitals_user_id" not in att_cols:
                conn.execute(text("ALTER TABLE attendances ADD COLUMN vitals_user_id INTEGER"))
            if "vitals_recorded_at" not in att_cols:
                conn.execute(text("ALTER TABLE attendances ADD COLUMN vitals_recorded_at DATETIME"))
    except Exception:
        pass

    try:
        with engine.begin() as conn:
            if not settings.DATABASE_URL.startswith("sqlite"):
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40)"))
                conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_id INTEGER"))
                conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address VARCHAR(255)"))
                conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS city VARCHAR(120)"))
                conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(180)"))
                conn.execute(text("ALTER TABLE clients ADD COLUMN IF NOT EXISTS state VARCHAR(2)"))
                conn.execute(text("ALTER TABLE stock_exits ADD COLUMN IF NOT EXISTS treatment_session_id INTEGER"))
                conn.execute(text("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS booking_id INTEGER"))
                conn.execute(text("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS external_prescription TEXT"))
                conn.execute(text("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS vitals_user_id INTEGER"))
                conn.execute(text("ALTER TABLE attendances ADD COLUMN IF NOT EXISTS vitals_recorded_at TIMESTAMP"))
                conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS cargo"))
                conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS role"))
    except Exception:
        pass

    db = SessionLocal()
    try:
        for row in db.query(StockEntry).all():
            if not row.entry_code or "-" in row.entry_code:
                row.entry_code = generate_entry_code(row.clinic_id, row.id)
        migrate_users_table(db)
        seed_profiles(db)
        sync_menu_catalog(db)
        db.commit()
    finally:
        db.close()

migrate_sqlite()

def seed():
    db = SessionLocal()
    try:
        clinic = db.query(Clinic).filter(Clinic.id == 1).first()
        if not clinic:
            clinic = Clinic(id=1, name="Clínica Principal", active=True)
            db.add(clinic)
            db.flush()

        by_slug = seed_profiles(db)
        admin_profile = by_slug["administrador"]

        admin_email = settings.ADMIN_EMAIL.strip()
        admin_password = settings.ADMIN_PASSWORD
        if not settings.is_production:
            if not admin_email:
                admin_email = "admin@localhost"
            if not admin_password:
                admin_password = secrets.token_urlsafe(10) + "1a"
                print(f"[DEV] Admin inicial: {admin_email} / {admin_password}")
        if admin_email and admin_password:
            if settings.is_production:
                validate_password_strength(admin_password)
            existing_admin = db.query(User).filter(
                User.clinic_id == clinic.id,
                User.email == admin_email,
            ).first()
            if existing_admin:
                if not settings.is_production and admin_password:
                    existing_admin.password_hash = get_password_hash(admin_password)
            elif admin_email and admin_password:
                db.add(User(
                    clinic_id=clinic.id,
                    profile_id=admin_profile.id,
                    name="Administrador",
                    email=admin_email,
                    password_hash=get_password_hash(admin_password),
                    active=True,
                ))

        if not db.query(Client).filter(
            Client.clinic_id == clinic.id,
            Client.name == settings.WRITE_OFF_CLIENT_NAME,
        ).first():
            db.add(Client(
                clinic_id=clinic.id,
                name=settings.WRITE_OFF_CLIENT_NAME,
                client_type=ClientType.setor_interno,
                notes="Cliente interno para baixa de produtos vencidos",
                active=True,
            ))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
seed()

_docs_kwargs = (
    {"docs_url": None, "redoc_url": None, "openapi_url": None}
    if settings.is_production
    else {}
)
app = FastAPI(title=settings.APP_NAME, version="1.0.0", **_docs_kwargs)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CsrfMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
_origins = settings.cors_origins_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(permissions.router)
app.include_router(crud.router)
app.include_router(stock.router)
app.include_router(reports.router)
app.include_router(attendances.router)
app.include_router(treatments.router)
app.include_router(treatments.public_router)
app.include_router(bookings.router)

@app.get("/")
def health():
    return {"status": "online", "app": settings.APP_NAME}
