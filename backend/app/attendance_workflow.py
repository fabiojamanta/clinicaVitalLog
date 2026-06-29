from typing import TYPE_CHECKING

from .models import MovementStatus

if TYPE_CHECKING:
    from .models import Attendance, Profile, TreatmentSession


def has_prescription(att: "Attendance") -> bool:
    return bool((att.prescription or "").strip())


def is_vitals_done(att: "Attendance") -> bool:
    return att.vitals_recorded_at is not None


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
    if not is_vitals_done(att):
        return "aguardando_sinais_vitais"
    if not is_doctor_done(att):
        return "aguardando_medico"
    if has_prescription(att) and not is_tech_done(att):
        return "aguardando_tecnica"
    return "aguardando_enfermagem"


def attendance_current_section(att: "Attendance") -> str:
    status = workflow_status(att)
    if status == "aguardando_sinais_vitais":
        return "sinais-vitais"
    if status == "aguardando_medico":
        return "medico"
    if status == "aguardando_tecnica":
        return "tecnica"
    if status == "concluido":
        return "finalizar"
    if has_prescription(att) and not has_dispensed(att):
        return "dispensar"
    return "finalizar"


def attendance_phase_label(att: "Attendance") -> str:
    section = attendance_current_section(att)
    labels = {
        "sinais-vitais": "Aguardando sinais vitais",
        "medico": "Aguardando médico",
        "tecnica": "Aguardando técnica",
        "dispensar": "Aguardando dispensação",
        "finalizar": "Concluído" if workflow_status(att) == "concluido" else "Aguardando finalização",
    }
    return labels.get(section, section)


def _is_enfermeira(profile: "Profile") -> bool:
    return profile.is_admin or profile.clinical_slug == "enfermeira"


def _is_tecnica(profile: "Profile") -> bool:
    return profile.is_admin or profile.clinical_slug == "tecnica_enfermagem"


def pending_items_for_role(att: "Attendance", profile: "Profile") -> list[tuple[str, str]]:
    if is_nursing_done(att):
        return []

    items: list[tuple[str, str]] = []

    if _is_enfermeira(profile):
        if not is_vitals_done(att):
            items.append(("enfermeira", "registrar_sinais_vitais"))

    if not is_vitals_done(att):
        return items

    if not is_doctor_done(att):
        return items

    if _is_tecnica(profile) or _is_enfermeira(profile):
        if has_prescription(att) and not is_tech_done(att):
            items.append(("tecnica_enfermagem", "tecnica"))

    if _is_enfermeira(profile):
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
    session: "TreatmentSession", profile: "Profile"
) -> list[tuple[str, str]]:
    status = session_status(session)
    if status == "concluido":
        return []

    items: list[tuple[str, str]] = []

    if status == "pendente" and (_is_tecnica(profile) or _is_enfermeira(profile)):
        items.append(("tecnica_enfermagem", "aplicar_sessao"))

    if status == "aguardando_enfermagem" and _is_enfermeira(profile):
        items.append(("enfermeira", "finalizar_sessao"))

    return items
