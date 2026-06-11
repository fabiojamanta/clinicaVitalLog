"""Comprovante PDF de sessão de tratamento com assinatura do paciente."""
import base64
from datetime import date, datetime
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from .models import Clinic, MovementStatus, TreatmentSession

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def _fmt_date(d: date | None) -> str:
    if not d:
        return "-"
    return d.strftime("%d/%m/%Y")


def _fmt_datetime(dt: datetime | None) -> str:
    if not dt:
        return "-"
    return dt.strftime("%d/%m/%Y %H:%M")


def _wrap_text(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> list[str]:
    lines: list[str] = []
    for raw_line in (text or "").splitlines() or [""]:
        words = raw_line.split(" ")
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if c.stringWidth(candidate, font, size) <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        lines.append(current)
    return lines


class _Writer:
    def __init__(self, c: canvas.Canvas):
        self.c = c
        self.y = PAGE_H - MARGIN

    def ensure_space(self, needed: float):
        if self.y - needed < MARGIN:
            self.c.showPage()
            self.y = PAGE_H - MARGIN

    def title(self, text: str):
        self.ensure_space(10 * mm)
        self.c.setFont("Helvetica-Bold", 14)
        self.c.drawString(MARGIN, self.y, text)
        self.y -= 8 * mm

    def section(self, text: str):
        self.ensure_space(9 * mm)
        self.y -= 2 * mm
        self.c.setFont("Helvetica-Bold", 11)
        self.c.drawString(MARGIN, self.y, text)
        self.y -= 6 * mm

    def line(self, text: str, font: str = "Helvetica", size: float = 10):
        max_width = PAGE_W - 2 * MARGIN
        for ln in _wrap_text(self.c, text, font, size, max_width):
            self.ensure_space(5 * mm)
            self.c.setFont(font, size)
            self.c.drawString(MARGIN, self.y, ln)
            self.y -= 5 * mm


def build_session_receipt_pdf(session: TreatmentSession, clinic: Clinic | None) -> bytes:
    treatment = session.treatment
    patient = treatment.patient if treatment else None

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w = _Writer(c)

    if clinic and clinic.name:
        w.line(clinic.name, font="Helvetica-Bold", size=12)
        if clinic.cnpj:
            w.line(f"CNPJ: {clinic.cnpj}", size=9)
        w.y -= 3 * mm

    w.title("Comprovante de Sessão de Tratamento")

    w.section("Dados da sessão")
    w.line(f"Paciente: {patient.name if patient else '-'}")
    w.line(f"Sessão: {session.session_number} de {treatment.total_sessions if treatment else '-'}")
    w.line(f"Data de realização: {_fmt_date(session.session_date)}")
    if treatment and treatment.doctor_user:
        w.line(f"Médico responsável: {treatment.doctor_user.name}")
    if session.tech_user:
        w.line(f"Aplicado por (técnica): {session.tech_user.name}")
    if session.nursing_user:
        w.line(f"Enfermeira: {session.nursing_user.name}")

    w.section("Medicamentos prescritos no tratamento")
    w.line(treatment.medications if treatment else "-")

    active_exits = [e for e in (session.exits or []) if e.status == MovementStatus.ativa]
    w.section("Medicamentos aplicados nesta sessão")
    if active_exits:
        for e in active_exits:
            unit = e.product.unit if e.product and e.product.unit else "un"
            lot = f" (lote {e.lot.lot_number})" if e.lot else ""
            w.line(f"- {e.product.name if e.product else '-'} — {e.quantity} {unit}{lot}")
    else:
        w.line("Nenhuma saída de medicamento registrada.")

    if (session.tech_notes or "").strip():
        w.section("Comentários da técnica")
        w.line(session.tech_notes)
    if (session.nursing_notes or "").strip():
        w.section("Comentários da enfermagem")
        w.line(session.nursing_notes)

    w.section("Confirmação do paciente")
    if session.patient_signature:
        try:
            b64 = session.patient_signature.split(",", 1)[-1]
            img = ImageReader(BytesIO(base64.b64decode(b64)))
            sig_w, sig_h = 70 * mm, 28 * mm
            w.ensure_space(sig_h + 12 * mm)
            c.drawImage(
                img, MARGIN, w.y - sig_h,
                width=sig_w, height=sig_h,
                preserveAspectRatio=True, anchor="sw", mask="auto",
            )
            w.y -= sig_h + 2 * mm
            c.setLineWidth(0.5)
            c.line(MARGIN, w.y, MARGIN + sig_w, w.y)
            w.y -= 5 * mm
            w.line(f"Assinado em: {_fmt_datetime(session.signed_at)}", size=9)
        except Exception:
            w.line("Assinatura registrada eletronicamente.")
            w.line(f"Assinado em: {_fmt_datetime(session.signed_at)}", size=9)
    else:
        w.line("Sessão ainda não assinada pelo paciente.")

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
