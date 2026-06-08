from typing import TYPE_CHECKING

from .models import MovementStatus, UserRole

if TYPE_CHECKING:
    from .models import Attendance


def has_prescription(att: "Attendance") -> bool:
    return bool((att.prescription or "").strip())


def is_doctor_done(att: "Attendance") -> bool:
    return att.doctor_updated_at is not None


def is_tech_done(att: "Attendance") -> bool:
    return att.tech_updated_at is not None


def is_nursing_done(att: "Attendance") -> bool:
    return att.nursing_updated_at is not None


def has_dispensed(att: "Attendance") -> bool:
    return any(e.status == MovementStatus.ativa for e in (att.exits or []))


def workflow_status(att: "Attendance") -> str:
    if is_nursing_done(att):
        return "concluido"
    if not is_doctor_done(att):
        return "aguardando_medico"
    if has_prescription(att) and not is_tech_done(att):
        return "aguardando_tecnica"
    return "aguardando_enfermagem"


def pending_items_for_role(att: "Attendance", role: UserRole) -> list[tuple[str, str]]:
    """Retorna lista de (pending_for, pending_action) para o atendimento."""
    if not is_doctor_done(att) or is_nursing_done(att):
        return []

    items: list[tuple[str, str]] = []

    if role in (UserRole.tecnica_enfermagem, UserRole.administrador):
        if has_prescription(att) and not is_tech_done(att):
            items.append(("tecnica_enfermagem", "tecnica"))

    if role in (UserRole.enfermeira, UserRole.administrador):
        if has_prescription(att) and not has_dispensed(att):
            items.append(("enfermeira", "dispensar"))
        if (
            not has_prescription(att)
            or has_dispensed(att)
            or is_tech_done(att)
        ):
            items.append(("enfermeira", "finalizar"))

    return items
