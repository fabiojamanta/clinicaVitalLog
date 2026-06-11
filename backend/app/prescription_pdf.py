"""Receita externa (exames/medicamentos de compra externa) em PDF."""
from datetime import date
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from .models import Attendance, Clinic

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def _fmt_date(d: date | None) -> str:
    if not d:
        return "-"
    return d.strftime("%d/%m/%Y")


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


def build_external_prescription_pdf(att: Attendance, clinic: Clinic | None) -> bytes:
    patient = att.patient
    doctor = att.doctor_user

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w = _Writer(c)

    if clinic and clinic.name:
        w.line(clinic.name, font="Helvetica-Bold", size=12)
        if clinic.cnpj:
            w.line(f"CNPJ: {clinic.cnpj}", size=9)
        w.y -= 3 * mm

    w.title("Receita / Orientação Externa")

    w.section("Paciente")
    w.line(f"Nome: {patient.name if patient else '-'}")
    if patient and patient.document:
        w.line(f"Documento: {patient.document}")
    w.line(f"Data: {_fmt_date(att.attendance_date)}")

    w.section("Prescrição / Exames / Medicamentos de compra externa")
    w.line(att.external_prescription or "-")

    w.section("Médico")
    w.line(doctor.name if doctor else "-")
    w.y -= 15 * mm
    w.line("_" * 40)
    w.line("Assinatura do médico", size=9)

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.getvalue()
