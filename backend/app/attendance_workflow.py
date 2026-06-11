from typing import TYPE_CHECKING

from .models import MovementStatus, UserRole

if TYPE_CHECKING:
    from .models import Attendance, TreatmentSession


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

    # Enfermeira acompanha também o que está pendente para a técnica
    if role in (UserRole.tecnica_enfermagem, UserRole.enfermeira, UserRole.administrador):
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


def session_status(session: "TreatmentSession") -> str:
    if session.nursing_updated_at is not None:
        return "concluido"
    if session.tech_updated_at is not None:
        return "aguardando_enfermagem"
    return "pendente"


def session_pending_items_for_role(
    session: "TreatmentSession", role: UserRole
) -> list[tuple[str, str]]:
    """Retorna lista de (pending_for, pending_action) para a sessão de tratamento."""
    status = session_status(session)
    if status == "concluido":
        return []

    items: list[tuple[str, str]] = []

    # Sessão ainda não aplicada: pendente para a técnica (enfermeira também vê/pode executar)
    if status == "pendente" and role in (
        UserRole.tecnica_enfermagem,
        UserRole.enfermeira,
        UserRole.administrador,
    ):
        items.append(("tecnica_enfermagem", "aplicar_sessao"))

    # Sessão aplicada pela técnica: enfermeira precisa finalizar
    if status == "aguardando_enfermagem" and role in (
        UserRole.enfermeira,
        UserRole.administrador,
    ):
        items.append(("enfermeira", "finalizar_sessao"))

    return items
