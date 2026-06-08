from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..datetime_utils import now_br
from ..models import Attendance, Client, ClientType, StockExit, MovementStatus, User, UserRole
from ..schemas import (
    AttendanceCreate,
    AttendanceSectionUpdate,
    AttendanceDispenseCreate,
    AttendanceListItem,
    AttendanceRead,
    AttendancePendingItem,
    ExitRead,
)
from ..deps import get_current_user, require_roles, log_action
from ..attendance_workflow import pending_items_for_role, workflow_status, has_dispensed
from .stock import perform_stock_exit, _exit_to_read

router = APIRouter(tags=["atendimentos"])

ATTENDANCE_ROLES = (UserRole.medico, UserRole.enfermeira, UserRole.tecnica_enfermagem)
DISPENSE_ROLES = (UserRole.enfermeira, UserRole.tecnica_enfermagem)


def _attendance_to_read(att: Attendance) -> AttendanceRead:
    return AttendanceRead(
        id=att.id,
        patient_id=att.patient_id,
        patient_name=att.patient.name if att.patient else None,
        attendance_date=att.attendance_date,
        doctor_notes=att.doctor_notes,
        prescription=att.prescription,
        tech_notes=att.tech_notes,
        nursing_notes=att.nursing_notes,
        doctor_user_id=att.doctor_user_id,
        tech_user_id=att.tech_user_id,
        nursing_user_id=att.nursing_user_id,
        doctor_user_name=att.doctor_user.name if att.doctor_user else None,
        tech_user_name=att.tech_user.name if att.tech_user else None,
        nursing_user_name=att.nursing_user.name if att.nursing_user else None,
        doctor_updated_at=att.doctor_updated_at,
        tech_updated_at=att.tech_updated_at,
        nursing_updated_at=att.nursing_updated_at,
        exits=[
            _exit_to_read(e)
            for e in sorted(att.exits, key=lambda e: e.id)
            if e.status == MovementStatus.ativa
        ],
    )


def _get_attendance(db: Session, user: User, attendance_id: int) -> Attendance:
    att = db.query(Attendance).filter_by(id=attendance_id, clinic_id=user.clinic_id).first()
    if not att:
        raise HTTPException(404, "Atendimento não encontrado")
    return att


@router.get("/attendances", response_model=list[AttendanceListItem])
def list_attendances(
    patient_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Attendance).filter(Attendance.clinic_id == user.clinic_id)
    if patient_id:
        q = q.filter(Attendance.patient_id == patient_id)
    rows = q.order_by(Attendance.attendance_date.desc(), Attendance.id.desc()).all()
    return [
        AttendanceListItem(
            id=r.id,
            patient_id=r.patient_id,
            patient_name=r.patient.name if r.patient else None,
            attendance_date=r.attendance_date,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.get("/attendances/pending", response_model=list[AttendancePendingItem])
def list_pending_attendances(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in (
        UserRole.administrador,
        UserRole.enfermeira,
        UserRole.tecnica_enfermagem,
    ):
        raise HTTPException(403, "Acesso negado")

    rows = (
        db.query(Attendance)
        .filter(
            Attendance.clinic_id == user.clinic_id,
            Attendance.doctor_updated_at.isnot(None),
            Attendance.nursing_updated_at.is_(None),
        )
        .order_by(Attendance.attendance_date.desc(), Attendance.doctor_updated_at.desc())
        .all()
    )

    result: list[AttendancePendingItem] = []
    for att in rows:
        for pending_for, pending_action in pending_items_for_role(att, user.role):
            result.append(
                AttendancePendingItem(
                    id=att.id,
                    patient_id=att.patient_id,
                    patient_name=att.patient.name if att.patient else None,
                    attendance_date=att.attendance_date,
                    pending_for=pending_for,
                    pending_action=pending_action,
                    workflow_status=workflow_status(att),
                    prescription=att.prescription,
                    doctor_user_name=att.doctor_user.name if att.doctor_user else None,
                    doctor_updated_at=att.doctor_updated_at,
                    has_dispensed=has_dispensed(att),
                )
            )
    return result


@router.get("/attendances/{attendance_id}", response_model=AttendanceRead)
def get_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    att = _get_attendance(db, user, attendance_id)
    return _attendance_to_read(att)


@router.post("/attendances", response_model=AttendanceRead)
def create_attendance(
    payload: AttendanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*ATTENDANCE_ROLES)),
):
    patient = db.query(Client).filter_by(id=payload.patient_id, clinic_id=user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Paciente não encontrado")
    if patient.client_type != ClientType.paciente:
        raise HTTPException(400, "O destinatário selecionado não é um paciente")

    existing = (
        db.query(Attendance)
        .filter_by(
            clinic_id=user.clinic_id,
            patient_id=payload.patient_id,
            attendance_date=payload.attendance_date,
        )
        .first()
    )
    if existing:
        return _attendance_to_read(existing)

    obj = Attendance(
        clinic_id=user.clinic_id,
        patient_id=payload.patient_id,
        attendance_date=payload.attendance_date,
        created_by=user.id,
    )
    db.add(obj)
    db.flush()
    log_action(
        db, user, "create", "attendances", obj.id,
        after={"patient_id": obj.patient_id, "attendance_date": obj.attendance_date.isoformat()},
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _attendance_to_read(obj)


def _update_section(
    db: Session,
    user: User,
    request: Request,
    attendance_id: int,
    section: str,
    payload: AttendanceSectionUpdate,
) -> Attendance:
    att = _get_attendance(db, user, attendance_id)
    now = now_br()
    if section == "doctor":
        before = {"doctor_notes": att.doctor_notes, "prescription": att.prescription}
        att.doctor_notes = payload.notes
        att.prescription = payload.prescription
        att.doctor_user_id = user.id
        att.doctor_updated_at = now
        after = {"doctor_notes": att.doctor_notes, "prescription": att.prescription}
    elif section == "tech":
        before = {"tech_notes": att.tech_notes}
        att.tech_notes = payload.notes
        att.tech_user_id = user.id
        att.tech_updated_at = now
        after = {"tech_notes": att.tech_notes}
    else:
        before = {"nursing_notes": att.nursing_notes}
        att.nursing_notes = payload.notes
        att.nursing_user_id = user.id
        att.nursing_updated_at = now
        after = {"nursing_notes": att.nursing_notes}
    log_action(
        db, user, f"update_{section}", "attendances", att.id,
        before=before, after=after, request=request,
    )
    db.commit()
    db.refresh(att)
    return att


@router.put("/attendances/{attendance_id}/doctor", response_model=AttendanceRead)
def update_doctor_section(
    attendance_id: int,
    payload: AttendanceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.medico)),
):
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "doctor", payload))


@router.put("/attendances/{attendance_id}/tech", response_model=AttendanceRead)
def update_tech_section(
    attendance_id: int,
    payload: AttendanceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.tecnica_enfermagem)),
):
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "tech", payload))


@router.put("/attendances/{attendance_id}/nursing", response_model=AttendanceRead)
def update_nursing_section(
    attendance_id: int,
    payload: AttendanceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.enfermeira)),
):
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "nursing", payload))


@router.post("/attendances/{attendance_id}/exits", response_model=ExitRead)
def dispense_medication(
    attendance_id: int,
    payload: AttendanceDispenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*DISPENSE_ROLES)),
):
    att = _get_attendance(db, user, attendance_id)
    obj = perform_stock_exit(
        db,
        user,
        product_id=payload.product_id,
        lot_id=payload.lot_id,
        client_id=att.patient_id,
        exit_date=att.attendance_date,
        quantity=payload.quantity,
        reason=payload.reason,
        notes=payload.notes,
        attendance_id=att.id,
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _exit_to_read(obj)
