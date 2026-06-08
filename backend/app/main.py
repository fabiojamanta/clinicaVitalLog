from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine, SessionLocal
from .models import Clinic, User, UserRole, Client, ClientType, StockEntry
from .entry_code import generate_entry_code
from .config import settings
from sqlalchemy import text
from .security import get_password_hash
from .routers import auth, crud, stock, reports, attendances

Base.metadata.create_all(bind=engine)

def migrate_sqlite():
    # Migração simples para SQLite (sem Alembic)
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
    except Exception:
        pass

    db = SessionLocal()
    try:
        for row in db.query(StockEntry).all():
            if not row.entry_code or "-" in row.entry_code:
                row.entry_code = generate_entry_code(row.clinic_id, row.id)
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

        if not db.query(User).filter(User.email == "admin_clinica.com").first():
            db.add(User(
                clinic_id=clinic.id,
                name="Administrador",
                email="admin_clinica.com",
                password_hash=get_password_hash("admin123"),
                role=UserRole.administrador,
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
                notes="Destinatário interno para baixa de produtos vencidos",
                active=True,
            ))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
seed()

app = FastAPI(title="VitalLog", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(crud.router)
app.include_router(stock.router)
app.include_router(reports.router)
app.include_router(attendances.router)

@app.get("/")
def health():
    return {"status": "online", "app": "VitalLog"}
