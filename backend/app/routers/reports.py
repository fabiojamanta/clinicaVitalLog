from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from ..database import get_db
from ..models import User
from ..deps import get_current_user
from ..report_service import (
    report_estoque_atual,
    report_vencimentos,
    report_saidas,
    report_fornecedores,
    report_clientes,
    report_produtos,
    EstoqueFilters,
    VencimentosFilters,
    SaidasFilters,
    FornecedoresFilters,
    ClientesFilters,
    ProdutosFilters,
)

router = APIRouter(prefix="/reports", tags=["relatorios"])

VALID_KINDS = ("estoque-atual", "vencimentos", "saidas", "fornecedores", "clientes", "produtos")


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _estoque_filters(
    product_id: Optional[int] = None,
    product_type: Optional[str] = None,
    stock_status: Optional[str] = None,
) -> EstoqueFilters:
    status = stock_status.upper() if stock_status else None
    if status and status not in ("BAIXO", "OK"):
        status = None
    return EstoqueFilters(
        product_id=product_id or None,
        product_type=product_type or None,
        stock_status=status,
    )


def _vencimentos_filters(
    product_id: Optional[int] = None,
    situation: Optional[str] = None,
    expiration_from: Optional[str] = None,
    expiration_to: Optional[str] = None,
) -> VencimentosFilters:
    sit = situation.strip() if situation else None
    if sit and sit not in ("Vencido", "A vencer", "OK"):
        sit = None
    return VencimentosFilters(
        product_id=product_id or None,
        situation=sit,
        expiration_from=_parse_date(expiration_from),
        expiration_to=_parse_date(expiration_to),
    )


def _saidas_filters(
    product_id: Optional[int] = None,
    client_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    exit_type: Optional[str] = None,
    status: Optional[str] = None,
) -> SaidasFilters:
    return SaidasFilters(
        product_id=product_id or None,
        client_id=client_id or None,
        date_from=_parse_date(date_from),
        date_to=_parse_date(date_to),
        exit_type=exit_type or None,
        status=status or None,
    )


def _fornecedores_filters(
    supplier_id: Optional[int] = None,
    active: Optional[str] = None,
) -> FornecedoresFilters:
    act = active if active in ("true", "false") else None
    return FornecedoresFilters(supplier_id=supplier_id or None, active=act)


def _clientes_filters(
    client_id: Optional[int] = None,
    client_type: Optional[str] = None,
    active: Optional[str] = None,
) -> ClientesFilters:
    act = active if active in ("true", "false") else None
    return ClientesFilters(
        client_id=client_id or None,
        client_type=client_type or None,
        active=act,
    )


def _produtos_filters(
    product_id: Optional[int] = None,
    product_type: Optional[str] = None,
    supplier_id: Optional[int] = None,
    active: Optional[str] = None,
    stock_status: Optional[str] = None,
) -> ProdutosFilters:
    act = active if active in ("true", "false") else None
    status = stock_status.upper() if stock_status else None
    if status and status not in ("BAIXO", "OK"):
        status = None
    return ProdutosFilters(
        product_id=product_id or None,
        product_type=product_type or None,
        supplier_id=supplier_id or None,
        active=act,
        stock_status=status,
    )


def _fetch_rows(
    kind: str,
    db: Session,
    user: User,
    product_id: Optional[int] = None,
    product_type: Optional[str] = None,
    stock_status: Optional[str] = None,
    situation: Optional[str] = None,
    expiration_from: Optional[str] = None,
    expiration_to: Optional[str] = None,
    client_id: Optional[int] = None,
    supplier_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    exit_type: Optional[str] = None,
    status: Optional[str] = None,
    active: Optional[str] = None,
    client_type: Optional[str] = None,
) -> list[dict]:
    if kind == "estoque-atual":
        return report_estoque_atual(
            db, user.clinic_id, _estoque_filters(product_id, product_type, stock_status)
        )
    if kind == "vencimentos":
        return report_vencimentos(
            db,
            user.clinic_id,
            _vencimentos_filters(product_id, situation, expiration_from, expiration_to),
        )
    if kind == "saidas":
        return report_saidas(
            db,
            user.clinic_id,
            _saidas_filters(product_id, client_id, date_from, date_to, exit_type, status),
        )
    if kind == "fornecedores":
        return report_fornecedores(
            db, user.clinic_id, _fornecedores_filters(supplier_id, active)
        )
    if kind == "clientes":
        return report_clientes(
            db, user.clinic_id, _clientes_filters(client_id, client_type, active)
        )
    if kind == "produtos":
        return report_produtos(
            db,
            user.clinic_id,
            _produtos_filters(product_id, product_type, supplier_id, active, stock_status),
        )
    raise HTTPException(404, "Relatório não encontrado")


@router.get("/estoque-atual")
def report_estoque_atual_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    product_type: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
):
    return _fetch_rows(
        "estoque-atual", db, user, product_id=product_id, product_type=product_type, stock_status=stock_status
    )


@router.get("/vencimentos")
def report_vencimentos_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    situation: Optional[str] = Query(None),
    expiration_from: Optional[str] = Query(None),
    expiration_to: Optional[str] = Query(None),
):
    return _fetch_rows(
        "vencimentos",
        db,
        user,
        product_id=product_id,
        situation=situation,
        expiration_from=expiration_from,
        expiration_to=expiration_to,
    )


@router.get("/saidas")
def report_saidas_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    client_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    exit_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    return _fetch_rows(
        "saidas",
        db,
        user,
        product_id=product_id,
        client_id=client_id,
        date_from=date_from,
        date_to=date_to,
        exit_type=exit_type,
        status=status,
    )


@router.get("/fornecedores")
def report_fornecedores_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    supplier_id: Optional[int] = Query(None),
    active: Optional[str] = Query(None),
):
    return _fetch_rows("fornecedores", db, user, supplier_id=supplier_id, active=active)


@router.get("/clientes")
def report_clientes_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    client_id: Optional[int] = Query(None),
    client_type: Optional[str] = Query(None),
    active: Optional[str] = Query(None),
):
    return _fetch_rows("clientes", db, user, client_id=client_id, client_type=client_type, active=active)


@router.get("/produtos")
def report_produtos_json(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    product_type: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    active: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
):
    return _fetch_rows(
        "produtos",
        db,
        user,
        product_id=product_id,
        product_type=product_type,
        supplier_id=supplier_id,
        active=active,
        stock_status=stock_status,
    )


@router.get("/{kind}.pdf")
def report_pdf(
    kind: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    product_type: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    situation: Optional[str] = Query(None),
    expiration_from: Optional[str] = Query(None),
    expiration_to: Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    exit_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[str] = Query(None),
    client_type: Optional[str] = Query(None),
):
    if kind not in VALID_KINDS:
        raise HTTPException(404, "Relatório não encontrado")

    rows = _fetch_rows(
        kind,
        db,
        user,
        product_id=product_id,
        product_type=product_type,
        stock_status=stock_status,
        situation=situation,
        expiration_from=expiration_from,
        expiration_to=expiration_to,
        client_id=client_id,
        supplier_id=supplier_id,
        date_from=date_from,
        date_to=date_to,
        exit_type=exit_type,
        status=status,
        active=active,
        client_type=client_type,
    )
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40
    p.setFont("Helvetica-Bold", 14)
    p.drawString(40, y, f"Relatório - {kind.replace('-', ' ').title()}")
    y -= 28
    p.setFont("Helvetica", 9)

    def line(txt: str):
        nonlocal y
        if y < 50:
            p.showPage()
            y = height - 40
            p.setFont("Helvetica", 9)
        p.drawString(40, y, str(txt)[:130])
        y -= 14

    if kind == "estoque-atual":
        for r in rows:
            line(f"{r['name']} | Tipo: {r['product_type']} | Estoque: {r['current_stock']} | Mínimo: {r['minimum_stock']} | {r['status']}")
    elif kind == "vencimentos":
        for r in rows:
            line(f"{r['product_name']} | Lote: {r['lot_number']} | Validade: {r['expiration_date']} | Dias: {r['days_remaining']} | Qtd: {r['current_stock']} | {r['situation']}")
    elif kind == "saidas":
        for r in rows:
            line(f"{r['exit_date']} | {r['product_name']} | Lote {r['lot_number']} | Cliente: {r['client_name']} | Qtd: {r['quantity']} | Por: {r['user_name']} | {r['status']} | {r['exit_type_label']}")
    elif kind == "fornecedores":
        for r in rows:
            line(f"{r['name']} | Doc: {r['document']} | Tel: {r['phone']} | Email: {r['email']} | Produtos: {r['products_count']} | Ativo: {r['active']}")
    elif kind == "clientes":
        for r in rows:
            line(f"{r['name']} | Tipo: {r['client_type_label']} | Doc: {r['document']} | Tel: {r['phone']} | Email: {r['email']} | Ativo: {r['active']}")
    elif kind == "produtos":
        for r in rows:
            line(
                f"{r['name']} | Tipo: {r['product_type_label']} | Fornecedor: {r['supplier_name']} | "
                f"Cód: {r['barcode']} | Estoque: {r['current_stock']} {r['unit']} | Mín: {r['minimum_stock']} | "
                f"Alerta: {r['expiration_alert_days']}d | {r['stock_status']} | Ativo: {r['active']}"
            )

    p.save()
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={kind}.pdf"},
    )


@router.get("/{kind}")
def report_json(
    kind: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: Optional[int] = Query(None),
    product_type: Optional[str] = Query(None),
    stock_status: Optional[str] = Query(None),
    situation: Optional[str] = Query(None),
    expiration_from: Optional[str] = Query(None),
    expiration_to: Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    exit_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[str] = Query(None),
    client_type: Optional[str] = Query(None),
):
    if kind not in VALID_KINDS:
        raise HTTPException(404, "Relatório não encontrado")
    return _fetch_rows(
        kind,
        db,
        user,
        product_id=product_id,
        product_type=product_type,
        stock_status=stock_status,
        situation=situation,
        expiration_from=expiration_from,
        expiration_to=expiration_to,
        client_id=client_id,
        supplier_id=supplier_id,
        date_from=date_from,
        date_to=date_to,
        exit_type=exit_type,
        status=status,
        active=active,
        client_type=client_type,
    )
