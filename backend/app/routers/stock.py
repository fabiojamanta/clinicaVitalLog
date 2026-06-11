from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from typing import Optional
from ..datetime_utils import today_br, parse_filter_datetime
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from ..database import get_db
from ..models import Product, Lot, StockEntry, StockExit, MovementStatus, ExitType, User, UserRole, AuditLog, Client
from ..schemas import EntryCreate, EntryRead, EntryLookupRead, ExitCreate, ExitRead, CancelExit, CancelEntry, AuditRead
from ..deps import get_current_user, require_roles, log_action
from ..entry_code import generate_entry_code, normalize_entry_code
from ..label_pdf import build_entry_label_pdf
from ..config import settings

router = APIRouter(tags=["estoque"])


def _entry_to_read(entry: StockEntry) -> EntryRead:
    return EntryRead(
        id=entry.id,
        entry_code=entry.entry_code,
        product_id=entry.product_id,
        supplier_id=entry.supplier_id,
        lot_id=entry.lot_id,
        lot_number=entry.lot.lot_number,
        expiration_date=entry.lot.expiration_date,
        entry_date=entry.entry_date,
        quantity=entry.quantity,
        notes=entry.notes,
        user_id=entry.user_id,
        status=entry.status,
        cancel_reason=entry.cancel_reason,
        product_name=entry.product.name,
        supplier_name=entry.supplier.name,
        lot_current_stock=entry.lot.current_stock,
    )


def _exit_to_read(row: StockExit) -> ExitRead:
    return ExitRead(
        id=row.id,
        product_id=row.product_id,
        lot_id=row.lot_id,
        client_id=row.client_id,
        exit_date=row.exit_date,
        quantity=row.quantity,
        exit_type=row.exit_type,
        reason=row.reason,
        notes=row.notes,
        user_id=row.user_id,
        status=row.status,
        cancel_reason=row.cancel_reason,
        product_name=row.product.name if row.product else None,
        lot_number=row.lot.lot_number if row.lot else None,
        client_name=row.client.name if row.client else None,
        user_name=row.user.name if row.user else None,
    )

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = today_br()
    products = db.query(Product).filter(Product.clinic_id == user.clinic_id, Product.active == True).all()
    low_stock = []
    for p in products:
        total = db.query(func.coalesce(func.sum(Lot.current_stock), 0)).filter(Lot.product_id == p.id, Lot.active == True).scalar() or 0
        if int(total) <= p.minimum_stock:
            low_stock.append({"product_id": p.id, "name": p.name, "current_stock": int(total), "minimum_stock": p.minimum_stock})
    lots = db.query(Lot).join(Product).filter(Lot.clinic_id == user.clinic_id, Lot.active == True, Lot.current_stock > 0).all()
    expired, near = [], []
    for l in lots:
        item = {"lot_id": l.id, "product": l.product.name, "lot_number": l.lot_number, "expiration_date": str(l.expiration_date), "current_stock": l.current_stock}
        if l.expiration_date < today:
            expired.append(item)
        elif l.expiration_date <= today + timedelta(days=l.product.expiration_alert_days):
            near.append(item)
    return {
        "total_products": len(products),
        "low_stock_count": len(low_stock),
        "near_expiration_count": len(near),
        "expired_count": len(expired),
        "low_stock": low_stock,
        "near_expiration": near,
        "expired": expired,
    }

@router.get("/entries", response_model=list[EntryRead])
def list_entries(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(StockEntry).filter(StockEntry.clinic_id == user.clinic_id).order_by(StockEntry.entry_date.desc(), StockEntry.id.desc()).all()
    return [_entry_to_read(r) for r in rows]


@router.get("/entries/by-code/{code}", response_model=EntryLookupRead)
def lookup_entry_by_code(code: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    normalized = normalize_entry_code(code)
    if not normalized:
        raise HTTPException(404, "Código de entrada não encontrado")
    entry = None
    for row in db.query(StockEntry).filter(StockEntry.clinic_id == user.clinic_id).all():
        if row.entry_code and normalize_entry_code(row.entry_code) == normalized:
            entry = row
            break
    if not entry:
        raise HTTPException(404, "Código de entrada não encontrado")
    if entry.status == MovementStatus.cancelada:
        raise HTTPException(400, "Entrada cancelada")
    if not entry.lot.active:
        raise HTTPException(400, "Lote desta entrada está inativo")
    return EntryLookupRead(
        entry_code=entry.entry_code,
        product_id=entry.product_id,
        product_name=entry.product.name,
        lot_id=entry.lot_id,
        lot_number=entry.lot.lot_number,
        expiration_date=entry.lot.expiration_date,
        quantity=entry.quantity,
        lot_current_stock=entry.lot.current_stock,
        expired=entry.lot.expiration_date < today_br(),
    )

@router.post("/entries", response_model=EntryRead)
def create_entry(payload: EntryCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(require_roles(UserRole.administrador, UserRole.estoque))):
    if payload.quantity <= 0: raise HTTPException(400, "Quantidade deve ser maior que zero")
    product = db.query(Product).filter_by(id=payload.product_id, clinic_id=user.clinic_id, active=True).first()
    if not product:
        raise HTTPException(404, "Produto não encontrado")
    if not product.supplier_id:
        raise HTTPException(400, "Produto sem fornecedor. Atualize o cadastro do produto.")

    lot = (
        db.query(Lot)
        .filter(
            Lot.clinic_id == user.clinic_id,
            Lot.active == True,
            Lot.product_id == payload.product_id,
            Lot.supplier_id == product.supplier_id,
            Lot.lot_number == payload.lot_number,
            Lot.expiration_date == payload.expiration_date,
        )
        .first()
    )
    if not lot:
        conflicting = (
            db.query(Lot)
            .filter(
                Lot.clinic_id == user.clinic_id,
                Lot.active == True,
                Lot.product_id == payload.product_id,
                Lot.supplier_id == product.supplier_id,
                Lot.lot_number == payload.lot_number,
                Lot.expiration_date != payload.expiration_date,
            )
            .first()
        )
        if conflicting:
            raise HTTPException(400, "Já existe um lote com este código, mas com outra validade.")
        lot = Lot(
            clinic_id=user.clinic_id,
            product_id=payload.product_id,
            supplier_id=product.supplier_id,
            lot_number=payload.lot_number,
            expiration_date=payload.expiration_date,
            current_stock=0,
            quantity_in_use=0,
            blocked=False,
            active=True,
        )
        db.add(lot)
        db.flush()

    before = {"lot_id": lot.id, "current_stock": lot.current_stock}
    lot.current_stock += payload.quantity
    obj = StockEntry(
        clinic_id=user.clinic_id,
        user_id=user.id,
        status=MovementStatus.ativa,
        product_id=payload.product_id,
        supplier_id=product.supplier_id,
        lot_id=lot.id,
        entry_date=payload.entry_date,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    db.add(obj); db.flush()
    obj.entry_code = generate_entry_code(user.clinic_id, obj.id)
    log_action(
        db,
        user,
        "stock_entry",
        "stock_entries",
        obj.id,
        before=before,
        after={
            "entry_code": obj.entry_code,
            "lot_id": lot.id,
            "current_stock": lot.current_stock,
            **payload.model_dump(),
            "supplier_id": product.supplier_id,
        },
        request=request,
    )
    db.commit(); db.refresh(obj)
    return _entry_to_read(obj)


@router.post("/entries/{entry_id}/cancel", response_model=EntryRead)
def cancel_entry(
    entry_id: int,
    payload: CancelEntry,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    obj = db.query(StockEntry).filter_by(id=entry_id, clinic_id=user.clinic_id).first()
    if not obj:
        raise HTTPException(404, "Entrada não encontrada")
    if obj.status == MovementStatus.cancelada:
        raise HTTPException(400, "Entrada já cancelada")
    if obj.user_id != user.id and user.role != UserRole.administrador:
        raise HTTPException(403, "Apenas quem registrou a entrada ou administrador pode cancelar")
    reason = (payload.cancel_reason or "").strip()
    if not reason:
        raise HTTPException(400, "Informe o motivo do cancelamento")

    lot = obj.lot
    if lot.current_stock < obj.quantity:
        raise HTTPException(
            400,
            "Não é possível cancelar: o saldo do lote é menor que a quantidade desta entrada (já houve saídas).",
        )

    before = {"entry_status": obj.status.value, "lot_stock": lot.current_stock}
    lot.current_stock -= obj.quantity
    obj.status = MovementStatus.cancelada
    obj.cancel_reason = reason
    log_action(
        db,
        user,
        "cancel_stock_entry",
        "stock_entries",
        obj.id,
        before=before,
        after={
            "entry_status": obj.status.value,
            "lot_stock": lot.current_stock,
            "cancel_reason": reason,
        },
        request=request,
    )
    db.commit()
    db.refresh(obj)
    return _entry_to_read(obj)


@router.get("/entries/{entry_id}/label.pdf")
def entry_label_pdf(
    entry_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    entry = (
        db.query(StockEntry)
        .filter(StockEntry.id == entry_id, StockEntry.clinic_id == user.clinic_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entrada não encontrada")
    if entry.status == MovementStatus.cancelada:
        raise HTTPException(400, "Entrada cancelada")
    if not entry.entry_code:
        raise HTTPException(400, "Entrada sem código de barras")
    pdf_bytes = build_entry_label_pdf(entry)
    filename = f"etiqueta-{entry.entry_code}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )


@router.get("/exits", response_model=list[ExitRead])
def list_exits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(StockExit).filter(StockExit.clinic_id == user.clinic_id).order_by(StockExit.exit_date.desc(), StockExit.id.desc()).all()
    return [_exit_to_read(r) for r in rows]

def perform_stock_exit(
    db: Session,
    user: User,
    *,
    product_id: int,
    lot_id: int,
    client_id: int,
    exit_date: date,
    quantity: int,
    exit_type: ExitType = ExitType.consumo,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    attendance_id: Optional[int] = None,
    treatment_session_id: Optional[int] = None,
    request: Optional[Request] = None,
) -> StockExit:
    """Valida lote, aplica a baixa no estoque e registra a saída (sem commit)."""
    if quantity <= 0:
        raise HTTPException(400, "Quantidade deve ser maior que zero")

    lot = db.query(Lot).filter_by(id=lot_id, clinic_id=user.clinic_id, active=True).first()
    if not lot:
        raise HTTPException(404, "Lote não encontrado")
    if product_id != lot.product_id:
        raise HTTPException(400, "Produto não corresponde ao lote informado")

    is_write_off = exit_type == ExitType.baixa_vencido
    if not is_write_off:
        if lot.expiration_date < today_br() or lot.blocked:
            raise HTTPException(400, "Lote vencido ou bloqueado. Saída não permitida.")
    if quantity > lot.current_stock:
        raise HTTPException(400, "Estoque insuficiente para este lote")

    before = {"lot_id": lot.id, "current_stock": lot.current_stock}
    lot.current_stock -= quantity
    if not is_write_off:
        lot.quantity_in_use += quantity

    obj = StockExit(
        clinic_id=user.clinic_id,
        user_id=user.id,
        status=MovementStatus.ativa,
        product_id=product_id,
        lot_id=lot_id,
        client_id=client_id,
        attendance_id=attendance_id,
        treatment_session_id=treatment_session_id,
        exit_date=exit_date,
        quantity=quantity,
        exit_type=exit_type,
        reason=reason,
        notes=notes,
    )
    db.add(obj); db.flush()
    audit_action = "stock_write_off" if is_write_off else "stock_exit"
    log_action(
        db, user, audit_action, "stock_exits", obj.id,
        before=before,
        after={
            "lot_id": lot.id,
            "current_stock": lot.current_stock,
            "product_id": product_id,
            "lot_id_payload": lot_id,
            "client_id": client_id,
            "attendance_id": attendance_id,
            "treatment_session_id": treatment_session_id,
            "exit_date": exit_date.isoformat(),
            "quantity": quantity,
            "exit_type": exit_type.value,
            "reason": reason,
            "notes": notes,
        },
        request=request,
    )
    return obj


@router.post("/exits", response_model=ExitRead)
def create_exit(payload: ExitCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.exit_type == ExitType.baixa_vencido:
        if user.role not in (UserRole.administrador, UserRole.estoque):
            raise HTTPException(403, "Baixa de vencido permitida apenas para administrador ou estoque")
        if not (payload.reason or "").strip():
            raise HTTPException(400, "Motivo é obrigatório para baixa de produto vencido")
    elif user.role not in (
        UserRole.administrador,
        UserRole.estoque,
        UserRole.operacional,
        UserRole.enfermeira,
        UserRole.tecnica_enfermagem,
    ):
        raise HTTPException(403, "Acesso negado")

    obj = perform_stock_exit(
        db,
        user,
        product_id=payload.product_id,
        lot_id=payload.lot_id,
        client_id=payload.client_id,
        exit_date=payload.exit_date,
        quantity=payload.quantity,
        exit_type=payload.exit_type,
        reason=payload.reason,
        notes=payload.notes,
        attendance_id=payload.attendance_id,
        request=request,
    )
    db.commit(); db.refresh(obj)
    return _exit_to_read(obj)

@router.post("/exits/{exit_id}/cancel", response_model=ExitRead)
def cancel_exit(exit_id: int, payload: CancelExit, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    obj = db.query(StockExit).filter_by(id=exit_id, clinic_id=user.clinic_id).first()
    if not obj: raise HTTPException(404, "Saída não encontrada")
    if obj.status == MovementStatus.cancelada: raise HTTPException(400, "Saída já cancelada")
    if obj.user_id != user.id and user.role != UserRole.administrador:
        raise HTTPException(403, "Apenas quem gerou a saída ou administrador pode cancelar")
    lot = obj.lot
    before = {"exit_status": obj.status.value, "lot_stock": lot.current_stock}
    lot.current_stock += obj.quantity
    if obj.exit_type != ExitType.baixa_vencido:
        lot.quantity_in_use = max(0, lot.quantity_in_use - obj.quantity)
    obj.status = MovementStatus.cancelada
    obj.cancel_reason = payload.cancel_reason
    log_action(db, user, "cancel_stock_exit", "stock_exits", obj.id, before=before, after={"exit_status": obj.status.value, "lot_stock": lot.current_stock, "cancel_reason": payload.cancel_reason}, request=request)
    db.commit(); db.refresh(obj)
    return _exit_to_read(obj)

@router.get("/audit", response_model=list[AuditRead])
def list_audit(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.administrador)),
    user_id: Optional[int] = Query(None),
    action: Optional[str] = Query(None),
    entity: Optional[str] = Query(None),
    entity_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    q = db.query(AuditLog).filter(AuditLog.clinic_id == user.clinic_id)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)
    if entity:
        q = q.filter(AuditLog.entity == entity)
    if entity_id:
        q = q.filter(AuditLog.entity_id == entity_id)
    dt_from = parse_filter_datetime(date_from, end=False)
    dt_to = parse_filter_datetime(date_to, end=True)
    if dt_from:
        q = q.filter(AuditLog.created_at >= dt_from)
    if dt_to:
        q = q.filter(AuditLog.created_at <= dt_to)

    rows = q.order_by(AuditLog.created_at.desc()).limit(500).all()
    return [
        AuditRead(
            id=r.id,
            user_id=r.user_id,
            user_name=r.user.name if r.user else None,
            action=r.action,
            entity=r.entity,
            entity_id=r.entity_id,
            before_data=r.before_data,
            after_data=r.after_data,
            created_at=r.created_at,
        )
        for r in rows
    ]
