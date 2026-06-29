from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..datetime_utils import now_br
from ..models import (
    Attendance,
    BookingStatus,
    Client,
    ClientType,
    Clinic,
    ConsultationBooking,
    MovementStatus,
    Payment,
    PaymentType,
    User,
    VitalSign,
    AccessLevel,
)
from ..schemas import (
    AttendanceCreate,
    AttendanceSectionUpdate,
    AttendanceDispenseCreate,
    AttendanceListItem,
    AttendanceRead,
    AttendancePendingItem,
    BookingSummary,
    ExitRead,
    PaymentRead,
    VitalSignRead,
    VitalSignUpdate,
)
from ..deps import get_current_user, log_action
from ..permissions import (
    require_menu_access,
    require_clinical_slug,
    user_is_admin,
    user_clinical_slug,
    get_user_permissions,
    has_menu_access,
)
from ..attendance_workflow import (
    attendance_current_section,
    attendance_phase_label,
    pending_items_for_role,
    session_pending_items_for_role,
    session_status,
    workflow_status,
    has_dispensed,
    is_vitals_done,
    is_doctor_done,
)
from ..models import Treatment, TreatmentSession
from ..prescription_pdf import build_external_prescription_pdf
from .stock import perform_stock_exit, _exit_to_read
router = APIRouter(tags=["atendimentos"])

def _money(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _calc_bmi(weight: Decimal | float | None, height: Decimal | float | None) -> float | None:
    if weight is None or height is None:
        return None
    h = float(height)
    if h <= 0:
        return None
    w = float(weight)
    bmi = w / ((h / 100) ** 2)
    return round(bmi, 1)


def _payment_to_read(p: Payment) -> PaymentRead:
    return PaymentRead(
        id=p.id,
        payment_type=p.payment_type,
        amount=float(p.amount),
        payment_method=p.payment_method,
        paid_at=p.paid_at,
        user_id=p.user_id,
        user_name=p.user.name if p.user else None,
        notes=p.notes,
    )


def _vital_to_read(vs: VitalSign, attendance_date=None) -> VitalSignRead:
    return VitalSignRead(
        id=vs.id,
        patient_id=vs.patient_id,
        attendance_id=vs.attendance_id,
        systolic_bp=vs.systolic_bp,
        diastolic_bp=vs.diastolic_bp,
        heart_rate=vs.heart_rate,
        temperature=float(vs.temperature) if vs.temperature is not None else None,
        weight=float(vs.weight) if vs.weight is not None else None,
        height=float(vs.height) if vs.height is not None else None,
        spo2=vs.spo2,
        glycemia=vs.glycemia,
        notes=vs.notes,
        recorded_by=vs.recorded_by,
        recorded_by_name=vs.recorder.name if vs.recorder else None,
        recorded_at=vs.recorded_at,
        attendance_date=attendance_date,
        bmi=_calc_bmi(vs.weight, vs.height),
    )


def _booking_summary(att: Attendance) -> BookingSummary | None:
    booking = att.booking
    if not booking:
        return None
    return BookingSummary(
        id=booking.id,
        scheduled_date=booking.scheduled_date,
        total_amount=float(booking.total_amount),
        deposit_amount=float(booking.deposit_amount),
        balance_amount=float(booking.balance_amount),
        status=booking.status,
        payments=[_payment_to_read(p) for p in sorted(booking.payments or [], key=lambda x: x.id)],
    )


def _attendance_to_read(att: Attendance) -> AttendanceRead:
    vs = att.vital_signs
    return AttendanceRead(
        id=att.id,
        patient_id=att.patient_id,
        patient_name=att.patient.name if att.patient else None,
        attendance_date=att.attendance_date,
        doctor_notes=att.doctor_notes,
        prescription=att.prescription,
        external_prescription=att.external_prescription,
        tech_notes=att.tech_notes,
        nursing_notes=att.nursing_notes,
        doctor_user_id=att.doctor_user_id,
        tech_user_id=att.tech_user_id,
        nursing_user_id=att.nursing_user_id,
        vitals_user_id=att.vitals_user_id,
        doctor_user_name=att.doctor_user.name if att.doctor_user else None,
        tech_user_name=att.tech_user.name if att.tech_user else None,
        nursing_user_name=att.nursing_user.name if att.nursing_user else None,
        vitals_user_name=att.vitals_user.name if att.vitals_user else None,
        doctor_updated_at=att.doctor_updated_at,
        tech_updated_at=att.tech_updated_at,
        nursing_updated_at=att.nursing_updated_at,
        vitals_recorded_at=att.vitals_recorded_at,
        workflow_status=workflow_status(att),
        booking=_booking_summary(att),
        vitals=_vital_to_read(vs, att.attendance_date) if vs else None,
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
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
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
            workflow_status=workflow_status(r),
            phase_label=attendance_phase_label(r),
            current_section=attendance_current_section(r),
        )
        for r in rows
    ]


@router.get("/attendances/pending", response_model=list[AttendancePendingItem])
def list_pending_attendances(
    patient_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    perms = get_user_permissions(db, user)
    if not has_menu_access(perms, "atendimentos_pendentes", AccessLevel.read, user_is_admin(user)):
        raise HTTPException(403, "Acesso negado")

    q = db.query(Attendance).filter(
        Attendance.clinic_id == user.clinic_id,
        Attendance.nursing_updated_at.is_(None),
    )
    if patient_id:
        q = q.filter(Attendance.patient_id == patient_id)
    rows = q.order_by(Attendance.attendance_date.desc(), Attendance.created_at.desc()).all()

    result: list[AttendancePendingItem] = []
    for att in rows:
        for pending_for, pending_action in pending_items_for_role(att, user.profile):
            result.append(
                AttendancePendingItem(
                    id=att.id,
                    item_type="atendimento",
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

    sq = (
        db.query(TreatmentSession)
        .join(Treatment)
        .filter(
            Treatment.clinic_id == user.clinic_id,
            Treatment.active == True,
            TreatmentSession.nursing_updated_at.is_(None),
        )
    )
    if patient_id:
        sq = sq.filter(Treatment.patient_id == patient_id)
    sessions = sq.order_by(TreatmentSession.treatment_id, TreatmentSession.session_number).all()

    seen_pending_treatment: set[int] = set()
    for s in sessions:
        t = s.treatment
        if session_status(s) == "pendente":
            if t.id in seen_pending_treatment:
                continue
            seen_pending_treatment.add(t.id)
        for pending_for, pending_action in session_pending_items_for_role(s, user.profile):
            result.append(
                AttendancePendingItem(
                    id=t.attendance_id,
                    item_type="sessao",
                    patient_id=t.patient_id,
                    patient_name=t.patient.name if t.patient else None,
                    attendance_date=s.session_date
                    or (t.attendance.attendance_date if t.attendance else t.created_at.date()),
                    pending_for=pending_for,
                    pending_action=pending_action,
                    workflow_status=session_status(s),
                    prescription=t.medications,
                    doctor_user_name=t.doctor_user.name if t.doctor_user else None,
                    doctor_updated_at=None,
                    has_dispensed=any(e.status == MovementStatus.ativa for e in (s.exits or [])),
                    session_id=s.id,
                    session_number=s.session_number,
                    total_sessions=t.total_sessions,
                )
            )
    if patient_id:
        result = [item for item in result if item.patient_id == patient_id]
    return result


@router.get("/patients/{patient_id}/vital-signs", response_model=list[VitalSignRead])
def list_patient_vital_signs(
    patient_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    perms = get_user_permissions(db, user)
    if not has_menu_access(perms, "atendimentos", AccessLevel.read, user_is_admin(user)):
        raise HTTPException(403, "Acesso negado")

    patient = db.query(Client).filter_by(id=patient_id, clinic_id=user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Paciente não encontrado")

    rows = (
        db.query(VitalSign)
        .filter(VitalSign.clinic_id == user.clinic_id, VitalSign.patient_id == patient_id)
        .order_by(VitalSign.recorded_at.asc())
        .all()
    )
    result = []
    for vs in rows:
        att_date = vs.attendance.attendance_date if vs.attendance else None
        result.append(_vital_to_read(vs, att_date))
    return result


@router.get("/attendances/{attendance_id}", response_model=AttendanceRead)
def get_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
):
    att = _get_attendance(db, user, attendance_id)
    return _attendance_to_read(att)


@router.post("/attendances", response_model=AttendanceRead)
def create_attendance(
    payload: AttendanceCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    patient = db.query(Client).filter_by(id=payload.patient_id, clinic_id=user.clinic_id).first()
    if not patient:
        raise HTTPException(404, "Paciente não encontrado")
    if patient.client_type != ClientType.paciente:
        raise HTTPException(400, "O cliente selecionado não é um paciente")

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

    if payload.total_amount and payload.total_amount > 0:
        perms = get_user_permissions(db, user)
        if not has_menu_access(perms, "reservas", AccessLevel.write, user_is_admin(user)):
            if not has_menu_access(perms, "atendimentos", AccessLevel.write, user_is_admin(user)):
                raise HTTPException(403, "Sem permissão para registrar pagamento na chegada")
        if not payload.payment_method:
            raise HTTPException(400, "Informe a forma de pagamento")

        total = _money(payload.total_amount)
        booking = ConsultationBooking(
            clinic_id=user.clinic_id,
            patient_id=payload.patient_id,
            scheduled_date=payload.attendance_date,
            total_amount=total,
            deposit_amount=total,
            balance_amount=Decimal("0.00"),
            status=BookingStatus.presente,
            attendance_id=obj.id,
            created_by=user.id,
        )
        db.add(booking)
        db.flush()
        obj.booking_id = booking.id

        payment = Payment(
            clinic_id=user.clinic_id,
            booking_id=booking.id,
            payment_type=PaymentType.entrada,
            amount=total,
            payment_method=payload.payment_method,
            paid_at=now_br(),
            user_id=user.id,
            notes=payload.payment_notes,
        )
        db.add(payment)

    log_action(
        db, user, "create", "attendances", obj.id,
        after={"patient_id": obj.patient_id, "attendance_date": obj.attendance_date.isoformat()},
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _attendance_to_read(obj)


@router.put("/attendances/{attendance_id}/vitals", response_model=AttendanceRead)
def update_vitals(
    attendance_id: int,
    payload: VitalSignUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    att = _get_attendance(db, user, attendance_id)
    if not user_is_admin(user) and user_clinical_slug(user) != "enfermeira":
        raise HTTPException(403, "Apenas enfermagem pode registrar sinais vitais")
    if is_doctor_done(att):
        raise HTTPException(400, "Consulta médica já registrada; sinais vitais bloqueados")

    now = now_br()
    vs = att.vital_signs
    if not vs:
        vs = VitalSign(
            clinic_id=user.clinic_id,
            patient_id=att.patient_id,
            attendance_id=att.id,
            recorded_by=user.id,
            recorded_at=now,
        )
        db.add(vs)

    vs.systolic_bp = payload.systolic_bp
    vs.diastolic_bp = payload.diastolic_bp
    vs.heart_rate = payload.heart_rate
    vs.temperature = payload.temperature
    vs.weight = payload.weight
    vs.height = payload.height
    vs.spo2 = payload.spo2
    vs.glycemia = payload.glycemia
    vs.notes = payload.notes
    vs.recorded_by = user.id
    vs.recorded_at = now

    att.vitals_user_id = user.id
    att.vitals_recorded_at = now

    log_action(
        db, user, "update_vitals", "attendances", att.id,
        after={"vitals_recorded_at": now.isoformat()},
        request=request,
    )
    db.commit()
    db.refresh(att)
    return _attendance_to_read(att)


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
        if not is_vitals_done(att):
            raise HTTPException(400, "Registre os sinais vitais antes da consulta médica")
        before = {
            "doctor_notes": att.doctor_notes,
            "prescription": att.prescription,
            "external_prescription": att.external_prescription,
        }
        att.doctor_notes = payload.notes
        att.prescription = payload.prescription
        if payload.external_prescription is not None:
            att.external_prescription = payload.external_prescription
        att.doctor_user_id = user.id
        att.doctor_updated_at = now
        after = {
            "doctor_notes": att.doctor_notes,
            "prescription": att.prescription,
            "external_prescription": att.external_prescription,
        }
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
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) != "medico":
        raise HTTPException(403, "Apenas médico pode salvar consulta")
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "doctor", payload))


@router.put("/attendances/{attendance_id}/tech", response_model=AttendanceRead)
def update_tech_section(
    attendance_id: int,
    payload: AttendanceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) != "tecnica_enfermagem":
        raise HTTPException(403, "Apenas técnica pode salvar esta seção")
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "tech", payload))


@router.put("/attendances/{attendance_id}/nursing", response_model=AttendanceRead)
def update_nursing_section(
    attendance_id: int,
    payload: AttendanceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) != "enfermeira":
        raise HTTPException(403, "Apenas enfermagem pode finalizar")
    return _attendance_to_read(_update_section(db, user, request, attendance_id, "nursing", payload))


@router.get("/attendances/{attendance_id}/external-prescription.pdf")
def external_prescription_pdf(
    attendance_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
):
    att = _get_attendance(db, user, attendance_id)
    cs = user_clinical_slug(user)
    if not user_is_admin(user) and cs != "medico" and att.doctor_user_id != user.id:
        raise HTTPException(403, "Acesso negado")
    if not (att.external_prescription or "").strip():
        raise HTTPException(400, "Receita externa não preenchida")

    clinic = db.query(Clinic).filter_by(id=user.clinic_id).first()
    pdf = build_external_prescription_pdf(att, clinic)
    filename = f"receita-externa-{att.id}.pdf"
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.post("/attendances/{attendance_id}/exits", response_model=ExitRead)
def dispense_medication(
    attendance_id: int,
    payload: AttendanceDispenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    cs = user_clinical_slug(user)
    if not user_is_admin(user) and cs not in ("enfermeira", "tecnica_enfermagem"):
        raise HTTPException(403, "Acesso negado")
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
