import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, log_action
from ..models import AccessLevel, MenuItemRecord, Profile, ProfilePermission, User
from ..permissions import get_profile_permissions, profile_to_dict, require_admin
from ..profile_seed import sync_menu_catalog
from ..schemas import ProfileCreate, ProfilePermissionsUpdate, ProfileUpdate

router = APIRouter(tags=["permissoes"])

_SLUG_RE = re.compile(r"^[a-z][a-z0-9_]{1,39}$")


def _menu_to_read(m: MenuItemRecord) -> dict:
    import json
    return {
        "menu_key": m.menu_key,
        "label": m.label,
        "route_paths": json.loads(m.route_paths or "[]"),
        "nav_group": m.nav_group,
        "sort_order": m.sort_order,
        "active": m.active,
    }


def _profile_to_read(p: Profile, db: Session) -> dict:
    user_count = db.query(User).filter(User.profile_id == p.id).count()
    return {
        "id": p.id,
        "name": p.name,
        "slug": p.slug,
        "is_system": p.is_system,
        "is_admin": p.is_admin,
        "clinical_slug": p.clinical_slug,
        "active": p.active,
        "user_count": user_count,
    }


@router.get("/menu-catalog")
def list_menu_catalog(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    sync_menu_catalog(db)
    db.commit()
    rows = db.query(MenuItemRecord).filter(MenuItemRecord.active == True).order_by(MenuItemRecord.sort_order).all()
    return [_menu_to_read(m) for m in rows]


@router.get("/profiles")
def list_profiles(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    rows = db.query(Profile).filter(Profile.clinic_id == user.clinic_id).order_by(Profile.name).all()
    return [_profile_to_read(p, db) for p in rows]


@router.get("/profiles/active")
def list_active_profiles(
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    rows = (
        db.query(Profile)
        .filter(Profile.clinic_id == user.clinic_id, Profile.active == True)
        .order_by(Profile.name)
        .all()
    )
    return [_profile_to_read(p, db) for p in rows]


@router.post("/profiles")
def create_profile(
    payload: ProfileCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    if db.query(Profile).filter(Profile.clinic_id == user.clinic_id, Profile.slug == payload.slug).first():
        raise HTTPException(400, "Slug já existe")

    p = Profile(
        clinic_id=user.clinic_id,
        name=payload.name.strip(),
        slug=payload.slug,
        is_system=False,
        is_admin=False,
        clinical_slug=payload.clinical_slug,
        active=True,
    )
    db.add(p)
    db.flush()
    sync_menu_catalog(db)
    log_action(db, user, "create", "profiles", p.id, after={"name": p.name, "slug": p.slug}, request=request)
    db.commit()
    db.refresh(p)
    return _profile_to_read(p, db)


@router.put("/profiles/{profile_id}")
def update_profile(
    profile_id: int,
    payload: ProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    p = db.query(Profile).filter_by(id=profile_id, clinic_id=user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Perfil não encontrado")
    if p.is_admin:
        raise HTTPException(400, "Perfil administrador não pode ser alterado")

    name = (payload.name or p.name).strip()
    slug = (payload.slug or p.slug).strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(400, "Slug inválido")
    other = db.query(Profile).filter(
        Profile.clinic_id == user.clinic_id,
        Profile.slug == slug,
        Profile.id != profile_id,
    ).first()
    if other:
        raise HTTPException(400, "Slug já existe")

    p.name = name
    if not p.is_system:
        p.slug = slug
    if payload.clinical_slug is not None:
        p.clinical_slug = payload.clinical_slug
    if payload.active is not None:
        p.active = payload.active

    log_action(db, user, "update", "profiles", p.id, after={"name": p.name, "slug": p.slug}, request=request)
    db.commit()
    db.refresh(p)
    return _profile_to_read(p, db)


@router.delete("/profiles/{profile_id}")
def delete_profile(
    profile_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    p = db.query(Profile).filter_by(id=profile_id, clinic_id=user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Perfil não encontrado")
    if p.is_system or p.is_admin:
        raise HTTPException(400, "Perfil de sistema não pode ser excluído")
    if db.query(User).filter(User.profile_id == p.id).count():
        raise HTTPException(400, "Perfil possui usuários vinculados")

    log_action(db, user, "delete", "profiles", p.id, before={"name": p.name}, request=request)
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.get("/profiles/{profile_id}/permissions")
def get_profile_permissions_endpoint(
    profile_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    p = db.query(Profile).filter_by(id=profile_id, clinic_id=user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Perfil não encontrado")
    sync_menu_catalog(db)
    db.commit()
    perms = get_profile_permissions(db, profile_id)
    menus = db.query(MenuItemRecord).filter(MenuItemRecord.active == True).order_by(MenuItemRecord.sort_order).all()
    return {
        "profile": _profile_to_read(p, db),
        "permissions": [
            {
                "menu_key": m.menu_key,
                "label": m.label,
                "access_level": perms.get(m.menu_key, "hidden"),
            }
            for m in menus
        ],
    }


@router.put("/profiles/{profile_id}/permissions")
def update_profile_permissions(
    profile_id: int,
    payload: ProfilePermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin()),
):
    p = db.query(Profile).filter_by(id=profile_id, clinic_id=user.clinic_id).first()
    if not p:
        raise HTTPException(404, "Perfil não encontrado")
    if p.is_admin:
        raise HTTPException(400, "Permissões do administrador são fixas")

    sync_menu_catalog(db)
    valid_keys = {m.menu_key for m in db.query(MenuItemRecord).all()}

    for item in payload.permissions:
        mk = item.menu_key
        if mk not in valid_keys:
            continue
        level = item.access_level
        row = db.query(ProfilePermission).filter_by(profile_id=profile_id, menu_key=mk).first()
        if row:
            row.access_level = level
        else:
            db.add(ProfilePermission(profile_id=profile_id, menu_key=mk, access_level=level))

    log_action(db, user, "update_permissions", "profiles", profile_id, request=request)
    db.commit()
    return get_profile_permissions_endpoint(profile_id, db, user)
