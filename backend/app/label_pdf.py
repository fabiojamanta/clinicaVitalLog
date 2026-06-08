"""Geração de etiqueta PDF com código de barras Code 128."""
from io import BytesIO
from datetime import date

import barcode
from barcode.writer import ImageWriter
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .models import StockEntry

LABEL_W = 100 * mm
LABEL_H = 60 * mm


def _fmt_date(d: date | None) -> str:
    if not d:
        return "-"
    return d.strftime("%d/%m/%Y")


def build_entry_label_pdf(entry: StockEntry) -> bytes:
    code = entry.entry_code or ""
    img_buf = BytesIO()
    Code128 = barcode.get_barcode_class("code128")
    Code128(code, writer=ImageWriter()).write(
        img_buf,
        options={
            "module_width": 0.35,
            "module_height": 14.0,
            "quiet_zone": 4.0,
            "font_size": 11,
            "text_distance": 4.0,
            "write_text": True,
        },
    )
    img_buf.seek(0)

    pdf_buf = BytesIO()
    c = canvas.Canvas(pdf_buf, pagesize=(LABEL_W, LABEL_H))
    margin = 4 * mm
    y = LABEL_H - margin

    c.setFont("Helvetica-Bold", 11)
    product_name = (entry.product.name or "")[:42]
    c.drawString(margin, y, product_name)
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    lines = [
        f"Lote: {entry.lot.lot_number}",
        f"Validade: {_fmt_date(entry.lot.expiration_date)}",
        f"Qtd entrada: {entry.quantity}",
        f"Data entrada: {_fmt_date(entry.entry_date)}",
    ]
    if entry.supplier:
        lines.append(f"Fornecedor: {(entry.supplier.name or '')[:35]}")
    for line in lines:
        c.drawString(margin, y, line)
        y -= 4 * mm

    barcode_h = 22 * mm
    barcode_w = LABEL_W - 2 * margin
    c.drawImage(ImageReader(img_buf), margin, margin, width=barcode_w, height=barcode_h, preserveAspectRatio=True, anchor="sw")

    c.showPage()
    c.save()
    pdf_buf.seek(0)
    return pdf_buf.getvalue()
