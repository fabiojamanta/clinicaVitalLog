"""Migração users: role/cargo -> profile_id."""
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from .config import settings
from .models import Profile, User
from .profile_seed import LEGACY_ROLE_TO_SLUG, seed_profiles


def _sqlite_rebuild_users_without_legacy(conn):
    """SQLite: recria tabela users sem cargo/role."""
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY,
            clinic_id INTEGER NOT NULL,
            profile_id INTEGER NOT NULL,
            name VARCHAR(160) NOT NULL,
            email VARCHAR(160) NOT NULL UNIQUE,
            phone VARCHAR(40),
            password_hash VARCHAR(255) NOT NULL,
            active BOOLEAN DEFAULT 1,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(clinic_id) REFERENCES clinics(id),
            FOREIGN KEY(profile_id) REFERENCES profiles(id)
        )
    """))
    conn.execute(text("""
        INSERT INTO users_new (id, clinic_id, profile_id, name, email, phone, password_hash, active, created_at, updated_at)
        SELECT id, clinic_id, profile_id, name, email, phone, password_hash, active, created_at, updated_at
        FROM users
    """))
    conn.execute(text("DROP TABLE users"))
    conn.execute(text("ALTER TABLE users_new RENAME TO users"))


def migrate_users_table(db: Session) -> None:
    bind = db.get_bind()
    inspector = inspect(bind)
    if "users" not in inspector.get_table_names():
        return

    cols = {c["name"] for c in inspector.get_columns("users")}
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    if "profile_id" not in cols:
        if is_sqlite:
            db.execute(text("ALTER TABLE users ADD COLUMN profile_id INTEGER"))
        else:
            db.execute(text("ALTER TABLE users ADD COLUMN profile_id INTEGER REFERENCES profiles(id)"))
        db.flush()
        cols.add("profile_id")

    by_slug = seed_profiles(db)
    admin_profile = by_slug["administrador"]

    if "role" in cols:
        rows = db.execute(text("SELECT id, role FROM users WHERE profile_id IS NULL")).fetchall()
        for row in rows:
            role_val = row[1]
            if hasattr(role_val, "value"):
                role_val = role_val.value
            slug = LEGACY_ROLE_TO_SLUG.get(str(role_val), "operacional")
            profile = by_slug.get(slug, admin_profile)
            db.execute(
                text("UPDATE users SET profile_id = :pid WHERE id = :uid"),
                {"pid": profile.id, "uid": row[0]},
            )
        unset = db.execute(text("SELECT COUNT(*) FROM users WHERE profile_id IS NULL")).scalar()
        if unset:
            db.execute(text("UPDATE users SET profile_id = :pid WHERE profile_id IS NULL"), {"pid": admin_profile.id})
    else:
        unset = db.execute(text("SELECT COUNT(*) FROM users WHERE profile_id IS NULL")).scalar() if "profile_id" in cols else 0
        if unset:
            db.execute(text("UPDATE users SET profile_id = :pid WHERE profile_id IS NULL"), {"pid": admin_profile.id})

    db.flush()

    if not is_sqlite and ("cargo" in cols or "role" in cols):
        if "cargo" in cols:
            db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS cargo"))
        if "role" in cols:
            db.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS role"))
        db.flush()
