from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..datetime_utils import now_br, today_br
from ..deps import get_current_user, log_action
from ..models import (
    Attendance,
    BookingStatus,
    Client,
    ClientType,
    ConsultationBooking,
    Payment,
    PaymentType,
    User,
    AccessLevel,
)
from ..permissions import require_menu_access
from ..schemas import BookingCheckIn, BookingCreate, BookingRead, PaymentRead

router = APIRouter(tags=["reservas"])

def _money(value: float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _split_amount(total: float) -> tuple[Decimal, Decimal]:
    total_d = _money(total)
    deposit = (total_d * Decimal("0.30")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    balance = total_d - deposit
    return deposit, balance


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


def _booking_to_read(b: ConsultationBooking) -> BookingRead:
    return BookingRead(
        id=b.id,
        patient_id=b.patient_id,
        patient_name=b.patient.name if b.patient else None,
        scheduled_date=b.scheduled_date,
        total_amount=float(b.total_amount),
        deposit_amount=float(b.deposit_amount),
        balance_amount=float(b.balance_amount),
        status=b.status,
        attendance_id=b.attendance_id,
        notes=b.notes,
        created_by=b.created_by,
        created_by_name=b.created_by_user.name if b.created_by_user else None,
        created_at=b.created_at,
        payments=[_payment_to_read(p) for p in sorted(b.payments or [], key=lambda x: x.id)],
    )


def _get_booking(db: Session, user: User, booking_id: int) -> ConsultationBooking:
    b = (
        db.query(ConsultationBooking)
        .filter_by(id=booking_id, clinic_id=user.clinic_id)
        .first()
    )
    if not b:
        raise HTTPException(404, "Reserva não encontrada")
    return b


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(
    patient_id: Optional[int] = Query(None),
    status: Optional[BookingStatus] = Query(None),
    scheduled_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("reservas", AccessLevel.read)),
):
    q = db.query(ConsultationBooking).filter(ConsultationBooking.clinic_id == user.clinic_id)
    if patient_id:
        q = q.filter(ConsultationBooking.patient_id == patient_id)
    if status:
        q = q.filter(ConsultationBooking.status == status)
    if scheduled_date:
        q = q.filter(ConsultationBooking.scheduled_date == scheduled_date)
    rows = q.order_by(
        ConsultationBooking.scheduled_date.desc(),
        ConsultationBooking.id.desc(),
    ).all()
    return [_booking_to_read(b) for b in rows]


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("reservas", AccessLevel.read)),
):
    return _booking_to_read(_get_booking(db, user, booking_id))


@router.post("/bookings", response_model=BookingRead)
def create_booking(
    payload: BookingCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("reservas", AccessLevel.write)),
):
    patient = (
        db.query(Client)
        .filter_by(id=payload.patient_id, clinic_id=user.clinic_id)
        .first()
    )
    if not patient:
        raise HTTPException(404, "Paciente não encontrado")
    if patient.client_type != ClientType.paciente:
        raise HTTPException(400, "O cliente selecionado não é um paciente")
    if payload.total_amount <= 0:
        raise HTTPException(400, "Informe o valor total da consulta")

    deposit, balance = _split_amount(payload.total_amount)
    booking = ConsultationBooking(
        clinic_id=user.clinic_id,
        patient_id=payload.patient_id,
        scheduled_date=payload.scheduled_date,
        total_amount=deposit + balance,
        deposit_amount=deposit,
        balance_amount=balance,
        status=BookingStatus.agendado,
        notes=payload.notes,
        created_by=user.id,
    )
    db.add(booking)
    db.flush()

    payment = Payment(
        clinic_id=user.clinic_id,
        booking_id=booking.id,
        payment_type=PaymentType.entrada,
        amount=deposit,
        payment_method=payload.payment_method,
        paid_at=payload.paid_at or now_br(),
        user_id=user.id,
        notes=payload.payment_notes,
    )
    db.add(payment)
    log_action(
        db,
        user,
        "create",
        "consultation_bookings",
        booking.id,
        after={
            "patient_id": booking.patient_id,
            "scheduled_date": booking.scheduled_date.isoformat(),
            "total_amount": str(booking.total_amount),
        },
        request=request,
    )
    db.commit()
    db.refresh(booking)
    return _booking_to_read(booking)


@router.post("/bookings/{booking_id}/check-in", response_model=BookingRead)
def check_in_booking(
    booking_id: int,
    payload: BookingCheckIn,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("reservas", AccessLevel.write)),
):
    booking = _get_booking(db, user, booking_id)
    if booking.status == BookingStatus.cancelado:
        raise HTTPException(400, "Reserva cancelada")
    if booking.status == BookingStatus.presente:
        raise HTTPException(400, "Check-in já realizado para esta reserva")

    attendance_date = today_br()
    existing = (
        db.query(Attendance)
        .filter_by(
            clinic_id=user.clinic_id,
            patient_id=booking.patient_id,
            attendance_date=attendance_date,
        )
        .first()
    )
    if existing:
        att = existing
        if not att.booking_id:
            att.booking_id = booking.id
    else:
        att = Attendance(
            clinic_id=user.clinic_id,
            patient_id=booking.patient_id,
            attendance_date=attendance_date,
            booking_id=booking.id,
            created_by=user.id,
        )
        db.add(att)
        db.flush()

    payment = Payment(
        clinic_id=user.clinic_id,
        booking_id=booking.id,
        payment_type=PaymentType.saldo,
        amount=booking.balance_amount,
        payment_method=payload.payment_method,
        paid_at=payload.paid_at or now_br(),
        user_id=user.id,
        notes=payload.payment_notes,
    )
    db.add(payment)

    booking.attendance_id = att.id
    booking.status = BookingStatus.presente

    log_action(
        db,
        user,
        "check_in",
        "consultation_bookings",
        booking.id,
        after={"attendance_id": att.id},
        request=request,
    )
    db.commit()
    db.refresh(booking)
    return _booking_to_read(booking)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_menu_access("reservas", AccessLevel.write)),
):
    booking = _get_booking(db, user, booking_id)
    if booking.status == BookingStatus.presente:
        raise HTTPException(400, "Não é possível cancelar reserva com check-in realizado")
    if booking.status == BookingStatus.cancelado:
        return _booking_to_read(booking)

    booking.status = BookingStatus.cancelado
    log_action(
        db,
        user,
        "cancel",
        "consultation_bookings",
        booking.id,
        request=request,
    )
    db.commit()
    db.refresh(booking)
    return _booking_to_read(booking)
