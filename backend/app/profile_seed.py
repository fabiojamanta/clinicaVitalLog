"""Seed de perfis sistema e permissões default (equivalente ao role-permissions.ts legado)."""
from sqlalchemy.orm import Session

from .models import AccessLevel, MenuItemRecord, Profile, ProfilePermission
from .menu_catalog import MENU_CATALOG, route_paths_json

SYSTEM_PROFILES: list[dict] = [
    {"slug": "administrador", "name": "Administrador", "is_admin": True, "clinical_slug": None},
    {"slug": "estoque", "name": "Estoque", "is_admin": False, "clinical_slug": None},
    {"slug": "operacional", "name": "Operacional", "is_admin": False, "clinical_slug": None},
    {"slug": "consulta", "name": "Consulta", "is_admin": False, "clinical_slug": None},
    {"slug": "medico", "name": "Médico", "is_admin": False, "clinical_slug": "medico"},
    {"slug": "enfermeira", "name": "Enfermagem", "is_admin": False, "clinical_slug": "enfermeira"},
    {"slug": "tecnica_enfermagem", "name": "Técnica de enfermagem", "is_admin": False, "clinical_slug": "tecnica_enfermagem"},
    {"slug": "vendedor", "name": "Vendedor", "is_admin": False, "clinical_slug": None},
]

# Matriz default: slug -> menu_key -> access_level
DEFAULT_PERMISSIONS: dict[str, dict[str, str]] = {
    "administrador": {},  # is_admin bypass — sem registros necessários
    "estoque": {
        "dashboard": "write",
        "fornecedores": "write",
        "clientes": "write",
        "produtos": "write",
        "entradas": "write",
        "saidas": "write",
        "relatorios": "write",
    },
    "operacional": {
        "dashboard": "write",
        "clientes": "write",
        "saidas": "write",
        "reservas": "write",
        "relatorios": "write",
    },
    "consulta": {
        "dashboard": "write",
        "fornecedores": "read",
        "clientes": "read",
        "produtos": "read",
        "relatorios": "write",
    },
    "medico": {
        "dashboard": "write",
        "atendimentos": "write",
        "relatorios": "write",
    },
    "enfermeira": {
        "dashboard": "write",
        "saidas": "write",
        "atendimentos": "write",
        "atendimentos_pendentes": "write",
        "relatorios": "write",
    },
    "tecnica_enfermagem": {
        "dashboard": "write",
        "saidas": "write",
        "atendimentos": "write",
        "atendimentos_pendentes": "write",
        "relatorios": "write",
    },
    "vendedor": {
        "dashboard": "write",
        "reservas": "write",
    },
}

LEGACY_ROLE_TO_SLUG = {
    "administrador": "administrador",
    "estoque": "estoque",
    "operacional": "operacional",
    "consulta": "consulta",
    "medico": "medico",
    "enfermeira": "enfermeira",
    "tecnica_enfermagem": "tecnica_enfermagem",
    "vendedor": "vendedor",
}


def sync_menu_catalog(db: Session) -> None:
    existing = {m.menu_key: m for m in db.query(MenuItemRecord).all()}
    for entry in MENU_CATALOG:
        row = existing.get(entry["menu_key"])
        if not row:
            row = MenuItemRecord(
                menu_key=entry["menu_key"],
                label=entry["label"],
                route_paths=route_paths_json(entry["route_paths"]),
                nav_group=entry.get("nav_group"),
                sort_order=entry["sort_order"],
                active=True,
            )
            db.add(row)
        else:
            row.label = entry["label"]
            row.route_paths = route_paths_json(entry["route_paths"])
            row.nav_group = entry.get("nav_group")
            row.sort_order = entry["sort_order"]
            row.active = True
    db.flush()

    profiles = db.query(Profile).filter(Profile.is_admin == False).all()
    menu_keys = [e["menu_key"] for e in MENU_CATALOG]
    for profile in profiles:
        for mk in menu_keys:
            if db.query(ProfilePermission).filter_by(profile_id=profile.id, menu_key=mk).first():
                continue
            db.add(ProfilePermission(
                profile_id=profile.id,
                menu_key=mk,
                access_level=AccessLevel.hidden,
            ))
    db.flush()


def seed_profiles(db: Session, clinic_id: int = 1) -> dict[str, Profile]:
    by_slug: dict[str, Profile] = {}
    for spec in SYSTEM_PROFILES:
        p = db.query(Profile).filter_by(clinic_id=clinic_id, slug=spec["slug"]).first()
        if not p:
            p = Profile(
                clinic_id=clinic_id,
                name=spec["name"],
                slug=spec["slug"],
                is_system=True,
                is_admin=spec["is_admin"],
                clinical_slug=spec["clinical_slug"],
                active=True,
            )
            db.add(p)
            db.flush()
        else:
            p.name = spec["name"]
            p.is_system = True
            p.is_admin = spec["is_admin"]
            p.clinical_slug = spec["clinical_slug"]
            p.active = True
        by_slug[spec["slug"]] = p

    sync_menu_catalog(db)

    for slug, perms in DEFAULT_PERMISSIONS.items():
        profile = by_slug.get(slug)
        if not profile or profile.is_admin:
            continue
        for menu_key, level_str in perms.items():
            level = AccessLevel(level_str)
            row = db.query(ProfilePermission).filter_by(
                profile_id=profile.id, menu_key=menu_key
            ).first()
            if row:
                row.access_level = level
            else:
                db.add(ProfilePermission(
                    profile_id=profile.id,
                    menu_key=menu_key,
                    access_level=level,
                ))
    db.flush()
    return by_slug
