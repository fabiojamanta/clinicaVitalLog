"""Validação de ownership multi-tenant (clinic_id)."""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Attendance, Client, Supplier


def assert_client_in_clinic(db: Session, client_id: int, clinic_id: int) -> Client:
    client = db.query(Client).filter_by(id=client_id, clinic_id=clinic_id).first()
    if not client:
        raise HTTPException(404, "Cliente não encontrado")
    return client


def assert_supplier_in_clinic(db: Session, supplier_id: int | None, clinic_id: int) -> Supplier | None:
    if not supplier_id:
        return None
    supplier = db.query(Supplier).filter_by(id=supplier_id, clinic_id=clinic_id, active=True).first()
    if not supplier:
        raise HTTPException(400, "Fornecedor não encontrado")
    return supplier


def assert_attendance_in_clinic(db: Session, attendance_id: int | None, clinic_id: int) -> Attendance | None:
    if not attendance_id:
        return None
    att = db.query(Attendance).filter_by(id=attendance_id, clinic_id=clinic_id).first()
    if not att:
        raise HTTPException(404, "Atendimento não encontrado")
    return att
