import secrets
from datetime import timedelta
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..attendance_workflow import session_status
from ..database import get_db
from ..datetime_utils import now_br, today_br
from ..deps import get_current_user, log_action
from ..models import (
    Attendance,
    Clinic,
    MovementStatus,
    Treatment,
    TreatmentSession,
    User,
    AccessLevel,
)
from ..permissions import require_menu_access, user_is_admin, user_clinical_slug
from ..receipt_pdf import build_session_receipt_pdf
from ..config import settings
from ..rate_limit import limiter
from ..signature_validation import validate_signature_data_url
from ..schemas import (
    AttendanceDispenseCreate,
    ExitRead,
    PublicSignCreate,
    PublicSignExitItem,
    PublicSignInfo,
    PublicSignPreview,
    SessionSignatureCreate,
    SignatureLinkRead,
    TreatmentCreate,
    TreatmentRead,
    TreatmentSessionListItem,
    TreatmentSessionRead,
    TreatmentSessionSectionUpdate,
)
from .stock import _exit_to_read, perform_stock_exit

router = APIRouter(tags=["tratamentos"])
public_router = APIRouter(prefix="/public", tags=["assinatura-publica"])

SIGNATURE_TOKEN_TTL = timedelta(minutes=30)
MAX_SESSIONS = 100


def _treatment_to_read(t: Treatment) -> TreatmentRead:
    sessions = sorted(t.sessions or [], key=lambda s: s.session_number)
    return TreatmentRead(
        id=t.id,
        attendance_id=t.attendance_id,
        patient_id=t.patient_id,
        patient_name=t.patient.name if t.patient else None,
        medications=t.medications,
        total_sessions=t.total_sessions,
        notes=t.notes,
        doctor_user_id=t.doctor_user_id,
        doctor_user_name=t.doctor_user.name if t.doctor_user else None,
        active=t.active,
        created_at=t.created_at,
        sessions_done=sum(1 for s in sessions if session_status(s) == "concluido"),
        sessions=[
            TreatmentSessionListItem(
                id=s.id,
                session_number=s.session_number,
                session_date=s.session_date,
                status=session_status(s),
                signed=bool(s.patient_signature),
            )
            for s in sessions
        ],
    )


def _session_to_read(s: TreatmentSession, *, include_signature: bool = False) -> TreatmentSessionRead:
    t = s.treatment
    return TreatmentSessionRead(
        id=s.id,
        treatment_id=s.treatment_id,
        session_number=s.session_number,
        total_sessions=t.total_sessions,
        patient_id=t.patient_id,
        patient_name=t.patient.name if t.patient else None,
        patient_phone=t.patient.phone if t.patient else None,
        medications=t.medications,
        treatment_notes=t.notes,
        doctor_user_name=t.doctor_user.name if t.doctor_user else None,
        session_date=s.session_date,
        tech_notes=s.tech_notes,
        tech_user_id=s.tech_user_id,
        tech_user_name=s.tech_user.name if s.tech_user else None,
        tech_updated_at=s.tech_updated_at,
        nursing_notes=s.nursing_notes,
        nursing_user_id=s.nursing_user_id,
        nursing_user_name=s.nursing_user.name if s.nursing_user else None,
        nursing_updated_at=s.nursing_updated_at,
        patient_signature=s.patient_signature if include_signature else None,
        signed_at=s.signed_at,
        status=session_status(s),
        exits=[
            _exit_to_read(e)
            for e in sorted(s.exits or [], key=lambda e: e.id)
            if e.status == MovementStatus.ativa
        ],
    )


def _get_session(db: Session, user: User, session_id: int) -> TreatmentSession:
    s = (
        db.query(TreatmentSession)
        .join(Treatment)
        .filter(TreatmentSession.id == session_id, Treatment.clinic_id == user.clinic_id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Sessão não encontrada")
    return s


@router.post("/attendances/{attendance_id}/treatments", response_model=TreatmentRead)
def create_treatment(
    attendance_id: int,
    payload: TreatmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) != "medico":
        raise HTTPException(403, "Apenas médico pode criar tratamento")
    att = db.query(Attendance).filter_by(id=attendance_id, clinic_id=user.clinic_id).first()
    if not att:
        raise HTTPException(404, "Atendimento não encontrado")
    medications = (payload.medications or "").strip()
    if not medications:
        raise HTTPException(400, "Informe os medicamentos do tratamento")
    if payload.total_sessions < 1 or payload.total_sessions > MAX_SESSIONS:
        raise HTTPException(400, f"Número de sessões deve ser entre 1 e {MAX_SESSIONS}")

    obj = Treatment(
        clinic_id=user.clinic_id,
        attendance_id=att.id,
        patient_id=att.patient_id,
        medications=medications,
        total_sessions=payload.total_sessions,
        notes=payload.notes,
        doctor_user_id=user.id,
        active=True,
    )
    db.add(obj)
    db.flush()
    for n in range(1, payload.total_sessions + 1):
        db.add(TreatmentSession(treatment_id=obj.id, session_number=n))
    log_action(
        db, user, "create", "treatments", obj.id,
        after={
            "attendance_id": att.id,
            "patient_id": att.patient_id,
            "medications": medications,
            "total_sessions": payload.total_sessions,
            "notes": payload.notes,
        },
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _treatment_to_read(obj)


@router.get("/treatments", response_model=list[TreatmentRead])
def list_treatments(
    patient_id: Optional[int] = Query(None),
    attendance_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
):
    q = db.query(Treatment).filter(
        Treatment.clinic_id == user.clinic_id,
        Treatment.active == True,
    )
    if patient_id:
        q = q.filter(Treatment.patient_id == patient_id)
    if attendance_id:
        q = q.filter(Treatment.attendance_id == attendance_id)
    rows = q.order_by(Treatment.id.desc()).all()
    return [_treatment_to_read(t) for t in rows]


@router.get("/treatment-sessions/{session_id}", response_model=TreatmentSessionRead)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
):
    return _session_to_read(_get_session(db, user, session_id), include_signature=True)


@router.put("/treatment-sessions/{session_id}/tech", response_model=TreatmentSessionRead)
def update_session_tech(
    session_id: int,
    payload: TreatmentSessionSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) not in ("tecnica_enfermagem",):
        raise HTTPException(403, "Apenas técnica pode aplicar sessão")
    s = _get_session(db, user, session_id)
    if session_status(s) == "concluido":
        raise HTTPException(400, "Sessão já concluída")
    if not payload.session_date:
        raise HTTPException(400, "Informe a data em que a sessão foi realizada")
    before = {"session_date": s.session_date, "tech_notes": s.tech_notes}
    s.session_date = payload.session_date
    s.tech_notes = payload.notes
    s.tech_user_id = user.id
    s.tech_updated_at = now_br()
    log_action(
        db, user, "update_tech", "treatment_sessions", s.id,
        before=before,
        after={"session_date": s.session_date.isoformat(), "tech_notes": s.tech_notes},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return _session_to_read(s)


@router.put("/treatment-sessions/{session_id}/nursing", response_model=TreatmentSessionRead)
def update_session_nursing(
    session_id: int,
    payload: TreatmentSessionSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    if not user_is_admin(user) and user_clinical_slug(user) != "enfermeira":
        raise HTTPException(403, "Apenas enfermagem pode finalizar sessão")
    s = _get_session(db, user, session_id)
    if session_status(s) == "concluido":
        raise HTTPException(400, "Sessão já concluída")
    if not s.patient_signature:
        raise HTTPException(400, "Colha a assinatura do paciente antes de finalizar a sessão")
    session_date = payload.session_date or s.session_date
    if not session_date:
        raise HTTPException(400, "Informe a data em que a sessão foi realizada")
    before = {"session_date": s.session_date, "nursing_notes": s.nursing_notes}
    s.session_date = session_date
    s.nursing_notes = payload.notes
    s.nursing_user_id = user.id
    s.nursing_updated_at = now_br()
    log_action(
        db, user, "update_nursing", "treatment_sessions", s.id,
        before=before,
        after={"session_date": s.session_date.isoformat(), "nursing_notes": s.nursing_notes},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return _session_to_read(s)


@router.post("/treatment-sessions/{session_id}/exits", response_model=ExitRead)
def dispense_session_medication(
    session_id: int,
    payload: AttendanceDispenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    cs = user_clinical_slug(user)
    if not user_is_admin(user) and cs not in ("enfermeira", "tecnica_enfermagem"):
        raise HTTPException(403, "Acesso negado")
    s = _get_session(db, user, session_id)
    if session_status(s) == "concluido":
        raise HTTPException(400, "Sessão já concluída")
    obj = perform_stock_exit(
        db,
        user,
        product_id=payload.product_id,
        lot_id=payload.lot_id,
        client_id=s.treatment.patient_id,
        exit_date=s.session_date or today_br(),
        quantity=payload.quantity,
        reason=payload.reason,
        notes=payload.notes,
        treatment_session_id=s.id,
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _exit_to_read(obj)


@router.post("/treatment-sessions/{session_id}/signature", response_model=TreatmentSessionRead)
def sign_session(
    session_id: int,
    payload: SessionSignatureCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    cs = user_clinical_slug(user)
    if not user_is_admin(user) and cs not in ("enfermeira", "tecnica_enfermagem"):
        raise HTTPException(403, "Acesso negado")
    s = _get_session(db, user, session_id)
    if session_status(s) == "concluido":
        raise HTTPException(400, "Sessão já concluída")
    signature = validate_signature_data_url((payload.signature or "").strip())
    s.patient_signature = signature
    s.signed_at = now_br()
    s.signature_token = None
    s.signature_token_expires_at = None
    log_action(
        db, user, "patient_signature", "treatment_sessions", s.id,
        after={"signed_at": s.signed_at.isoformat(), "method": "presencial"},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return _session_to_read(s, include_signature=True)


@router.post("/treatment-sessions/{session_id}/signature-link", response_model=SignatureLinkRead)
def create_signature_link(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.write)),
):
    cs = user_clinical_slug(user)
    if not user_is_admin(user) and cs not in ("enfermeira", "tecnica_enfermagem"):
        raise HTTPException(403, "Acesso negado")
    s = _get_session(db, user, session_id)
    if session_status(s) == "concluido":
        raise HTTPException(400, "Sessão já concluída")
    if s.patient_signature:
        raise HTTPException(400, "Sessão já assinada pelo paciente")
    s.signature_token = secrets.token_urlsafe(32)
    s.signature_token_expires_at = now_br() + SIGNATURE_TOKEN_TTL
    log_action(
        db, user, "signature_link", "treatment_sessions", s.id,
        after={"expires_at": s.signature_token_expires_at.isoformat()},
        request=request,
    )
    db.commit()
    db.refresh(s)
    return SignatureLinkRead(token=s.signature_token, expires_at=s.signature_token_expires_at)


@router.get("/treatment-sessions/{session_id}/receipt.pdf")
def session_receipt_pdf(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("atendimentos", AccessLevel.read)),
):
    s = _get_session(db, user, session_id)
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    pdf_bytes = build_session_receipt_pdf(s, clinic)
    filename = f"comprovante-sessao-{s.id}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


def _get_session_by_token(db: Session, token: str) -> TreatmentSession:
    s = db.query(TreatmentSession).filter(TreatmentSession.signature_token == token).first()
    if not s:
        raise HTTPException(404, "Link inválido ou já utilizado")
    if not s.signature_token_expires_at or s.signature_token_expires_at < now_br():
        raise HTTPException(410, "Link expirado. Solicite um novo link na clínica.")
    if s.patient_signature:
        raise HTTPException(409, "Esta sessão já foi assinada")
    if session_status(s) == "concluido":
        raise HTTPException(409, "Esta sessão já foi concluída")
    return s


def _session_comments(s: TreatmentSession) -> Optional[str]:
    parts = [p.strip() for p in (s.tech_notes, s.nursing_notes) if p and p.strip()]
    return "\n".join(parts) or None


def _clinic_name(db: Session, s: TreatmentSession) -> str:
    clinic_id = s.treatment.clinic_id if s.treatment else 1
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    return clinic.name if clinic else "Clínica"


def _public_preview(db: Session, s: TreatmentSession) -> PublicSignPreview:
    t = s.treatment
    return PublicSignPreview(
        clinic_name=_clinic_name(db, s),
        session_number=s.session_number,
        total_sessions=t.total_sessions,
        session_date=s.session_date,
        ready_to_sign=True,
    )


def _public_info(s: TreatmentSession) -> PublicSignInfo:
    t = s.treatment
    return PublicSignInfo(
        patient_name=t.patient.name if t.patient else "-",
        session_number=s.session_number,
        total_sessions=t.total_sessions,
        session_date=s.session_date,
        medications=t.medications,
        comments=_session_comments(s),
        exits=[
            PublicSignExitItem(
                product_name=e.product.name if e.product else "-",
                quantity=e.quantity,
                unit=e.product.unit if e.product else None,
            )
            for e in sorted(s.exits or [], key=lambda e: e.id)
            if e.status == MovementStatus.ativa
        ],
    )


@public_router.get("/sign/{token}", response_model=PublicSignPreview)
@limiter.limit("20/minute")
def public_sign_info(token: str, request: Request, db: Session = Depends(get_db)):
    return _public_preview(db, _get_session_by_token(db, token))


@public_router.post("/sign/{token}/prepare", response_model=PublicSignInfo)
@limiter.limit("20/minute")
def public_sign_prepare(token: str, request: Request, db: Session = Depends(get_db)):
    return _public_info(_get_session_by_token(db, token))


@public_router.post("/sign/{token}", response_model=PublicSignInfo)
@limiter.limit("10/minute")
def public_sign_submit(
    token: str,
    payload: PublicSignCreate,
    request: Request,
    db: Session = Depends(get_db),
):
    s = _get_session_by_token(db, token)
    if settings.PUBLIC_SIGN_PIN and (payload.pin or "").strip() != settings.PUBLIC_SIGN_PIN:
        raise HTTPException(403, "PIN inválido")
    signature = validate_signature_data_url((payload.signature or "").strip())
    s.patient_signature = signature
    s.signed_at = now_br()
    s.signature_token = None
    s.signature_token_expires_at = None
    clinic_id = s.treatment.clinic_id if s.treatment else 1
    log_action(
        db, None, "patient_signature", "treatment_sessions", s.id,
        after={"signed_at": s.signed_at.isoformat(), "method": "remoto"},
        request=request,
        clinic_id=clinic_id,
    )
    db.commit()
    db.refresh(s)
    return _public_info(s)
