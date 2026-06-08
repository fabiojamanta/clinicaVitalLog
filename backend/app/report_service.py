"""Dados estruturados para relatórios (tela HTML e PDF)."""
from dataclasses import dataclass
from datetime import date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import (
    Product,
    Lot,
    StockExit,
    ExitType,
    ProductType,
    MovementStatus,
    Supplier,
    Client,
    ClientType,
)
from .datetime_utils import today_br
from .format_utils import format_cpf_cnpj, format_phone_br

CLIENT_TYPE_LABELS = {
    ClientType.paciente: "Paciente",
    ClientType.medico: "Médico",
    ClientType.setor_interno: "Setor interno",
    ClientType.funcionario: "Funcionário",
    ClientType.outro: "Outro",
}

PRODUCT_TYPE_LABELS = {
    ProductType.insumos: "Insumos",
    ProductType.homeopaticos: "Homeopáticos",
    ProductType.injetaveis: "Injetáveis",
    ProductType.vo: "V.O.",
}


@dataclass
class EstoqueFilters:
    product_id: Optional[int] = None
    product_type: Optional[str] = None
    stock_status: Optional[str] = None  # BAIXO | OK


@dataclass
class VencimentosFilters:
    product_id: Optional[int] = None
    situation: Optional[str] = None  # Vencido | A vencer | OK
    expiration_from: Optional[date] = None
    expiration_to: Optional[date] = None


@dataclass
class SaidasFilters:
    product_id: Optional[int] = None
    client_id: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    exit_type: Optional[str] = None
    status: Optional[str] = None  # ativa | cancelada


@dataclass
class FornecedoresFilters:
    supplier_id: Optional[int] = None
    active: Optional[str] = None  # true | false


@dataclass
class ClientesFilters:
    client_id: Optional[int] = None
    client_type: Optional[str] = None
    active: Optional[str] = None  # true | false


@dataclass
class ProdutosFilters:
    product_id: Optional[int] = None
    product_type: Optional[str] = None
    supplier_id: Optional[int] = None
    active: Optional[str] = None  # true | false
    stock_status: Optional[str] = None  # BAIXO | OK


def _apply_active_filter(q, model, active: Optional[str]):
    if active == "true":
        return q.filter(model.active == True)
    if active == "false":
        return q.filter(model.active == False)
    return q


def _lot_situation(lot: Lot, today: date) -> str:
    dias = (lot.expiration_date - today).days
    if lot.expiration_date < today:
        return "Vencido"
    alert = lot.product.expiration_alert_days if lot.product else 30
    if dias <= alert:
        return "A vencer"
    return "OK"


def report_estoque_atual(db: Session, clinic_id: int, filters: EstoqueFilters | None = None) -> list[dict]:
    f = filters or EstoqueFilters()
    q = db.query(Product).filter(Product.clinic_id == clinic_id, Product.active == True)
    if f.product_id:
        q = q.filter(Product.id == f.product_id)
    if f.product_type:
        try:
            ptype = ProductType(f.product_type)
            q = q.filter(Product.product_type == ptype)
        except ValueError:
            pass

    rows = []
    for prod in q.order_by(Product.name).all():
        total = (
            db.query(func.coalesce(func.sum(Lot.current_stock), 0))
            .filter(Lot.product_id == prod.id, Lot.active == True)
            .scalar()
            or 0
        )
        total = int(total)
        status = "BAIXO" if total <= prod.minimum_stock else "OK"
        if f.stock_status and status != f.stock_status:
            continue
        rows.append({
            "product_id": prod.id,
            "name": prod.name,
            "product_type": prod.product_type.value,
            "current_stock": total,
            "minimum_stock": prod.minimum_stock,
            "unit": prod.unit or "un",
            "status": status,
        })
    return rows


def report_vencimentos(db: Session, clinic_id: int, filters: VencimentosFilters | None = None) -> list[dict]:
    f = filters or VencimentosFilters()
    today = today_br()
    q = (
        db.query(Lot)
        .join(Product)
        .filter(Lot.clinic_id == clinic_id, Lot.current_stock > 0, Lot.active == True)
    )
    if f.product_id:
        q = q.filter(Lot.product_id == f.product_id)
    if f.expiration_from:
        q = q.filter(Lot.expiration_date >= f.expiration_from)
    if f.expiration_to:
        q = q.filter(Lot.expiration_date <= f.expiration_to)

    rows = []
    for lot in q.order_by(Lot.expiration_date).all():
        situacao = _lot_situation(lot, today)
        if f.situation and situacao != f.situation:
            continue
        dias = (lot.expiration_date - today).days
        rows.append({
            "product_name": lot.product.name,
            "lot_number": lot.lot_number,
            "expiration_date": str(lot.expiration_date),
            "days_remaining": dias,
            "current_stock": lot.current_stock,
            "situation": situacao,
        })
    return rows


def report_saidas(db: Session, clinic_id: int, filters: SaidasFilters | None = None, limit: int = 500) -> list[dict]:
    f = filters or SaidasFilters()
    q = db.query(StockExit).filter(StockExit.clinic_id == clinic_id)
    if f.product_id:
        q = q.filter(StockExit.product_id == f.product_id)
    if f.client_id:
        q = q.filter(StockExit.client_id == f.client_id)
    if f.date_from:
        q = q.filter(StockExit.exit_date >= f.date_from)
    if f.date_to:
        q = q.filter(StockExit.exit_date <= f.date_to)
    if f.exit_type:
        try:
            q = q.filter(StockExit.exit_type == ExitType(f.exit_type))
        except ValueError:
            pass
    if f.status:
        try:
            q = q.filter(StockExit.status == MovementStatus(f.status))
        except ValueError:
            pass

    rows = []
    for row in q.order_by(StockExit.exit_date.desc(), StockExit.id.desc()).limit(limit).all():
        exit_type_label = "Baixa vencido" if row.exit_type == ExitType.baixa_vencido else "Consumo"
        rows.append({
            "id": row.id,
            "exit_date": str(row.exit_date),
            "product_name": row.product.name if row.product else "",
            "lot_number": row.lot.lot_number if row.lot else "",
            "client_name": row.client.name if row.client else "",
            "user_name": row.user.name if row.user else "",
            "quantity": row.quantity,
            "exit_type": row.exit_type.value,
            "exit_type_label": exit_type_label,
            "status": row.status.value,
            "reason": row.reason or "",
        })
    return rows


def report_fornecedores(db: Session, clinic_id: int, filters: FornecedoresFilters | None = None) -> list[dict]:
    f = filters or FornecedoresFilters()
    q = db.query(Supplier).filter(Supplier.clinic_id == clinic_id)
    if f.supplier_id:
        q = q.filter(Supplier.id == f.supplier_id)
    q = _apply_active_filter(q, Supplier, f.active)

    rows = []
    for s in q.order_by(Supplier.name).all():
        products_count = (
            db.query(func.count(Product.id))
            .filter(Product.clinic_id == clinic_id, Product.supplier_id == s.id, Product.active == True)
            .scalar()
            or 0
        )
        rows.append({
            "id": s.id,
            "name": s.name,
            "document": format_cpf_cnpj(s.document),
            "phone": format_phone_br(s.phone),
            "email": s.email or "",
            "address": s.address or "",
            "products_count": int(products_count),
            "active": "Sim" if s.active else "Não",
        })
    return rows


def report_produtos(db: Session, clinic_id: int, filters: ProdutosFilters | None = None) -> list[dict]:
    f = filters or ProdutosFilters()
    q = db.query(Product).filter(Product.clinic_id == clinic_id)
    if f.product_id:
        q = q.filter(Product.id == f.product_id)
    if f.product_type:
        try:
            q = q.filter(Product.product_type == ProductType(f.product_type))
        except ValueError:
            pass
    if f.supplier_id:
        q = q.filter(Product.supplier_id == f.supplier_id)
    q = _apply_active_filter(q, Product, f.active)

    rows = []
    for prod in q.order_by(Product.name).all():
        total = (
            db.query(func.coalesce(func.sum(Lot.current_stock), 0))
            .filter(Lot.product_id == prod.id, Lot.active == True)
            .scalar()
            or 0
        )
        total = int(total)
        status = "BAIXO" if total <= prod.minimum_stock else "OK"
        if f.stock_status and status != f.stock_status:
            continue
        rows.append({
            "id": prod.id,
            "name": prod.name,
            "product_type": prod.product_type.value,
            "product_type_label": PRODUCT_TYPE_LABELS.get(prod.product_type, prod.product_type.value),
            "supplier_name": prod.supplier.name if prod.supplier else "",
            "barcode": prod.barcode or "",
            "unit": prod.unit or "un",
            "minimum_stock": prod.minimum_stock,
            "expiration_alert_days": prod.expiration_alert_days,
            "current_stock": total,
            "stock_status": status,
            "active": "Sim" if prod.active else "Não",
        })
    return rows


def report_clientes(db: Session, clinic_id: int, filters: ClientesFilters | None = None) -> list[dict]:
    f = filters or ClientesFilters()
    q = db.query(Client).filter(Client.clinic_id == clinic_id)
    if f.client_id:
        q = q.filter(Client.id == f.client_id)
    if f.client_type:
        try:
            q = q.filter(Client.client_type == ClientType(f.client_type))
        except ValueError:
            pass
    q = _apply_active_filter(q, Client, f.active)

    rows = []
    for c in q.order_by(Client.name).all():
        rows.append({
            "id": c.id,
            "name": c.name,
            "client_type": c.client_type.value,
            "client_type_label": CLIENT_TYPE_LABELS.get(c.client_type, c.client_type.value),
            "document": format_cpf_cnpj(c.document),
            "phone": format_phone_br(c.phone),
            "email": c.email or "",
            "active": "Sim" if c.active else "Não",
        })
    return rows
