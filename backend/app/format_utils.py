"""Formatação de CPF/CNPJ e telefone para exibição e normalização."""
import re


def digits_only(value: str | None) -> str | None:
    if value is None:
        return None
    d = re.sub(r"\D", "", value)
    return d if d else None


def format_cpf_cnpj(value: str | None) -> str:
    d = digits_only(value) or ""
    if not d:
        return ""
    if len(d) <= 11:
        d = d[:11]
        if len(d) <= 3:
            return d
        if len(d) <= 6:
            return f"{d[:3]}.{d[3:]}"
        if len(d) <= 9:
            return f"{d[:3]}.{d[3:6]}.{d[6:]}"
        return f"{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}"
    d = d[:14]
    if len(d) <= 2:
        return d
    if len(d) <= 5:
        return f"{d[:2]}.{d[2:]}"
    if len(d) <= 8:
        return f"{d[:2]}.{d[2:5]}.{d[5:]}"
    if len(d) <= 12:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:]}"
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"


def format_phone_br(value: str | None) -> str:
    d = digits_only(value) or ""
    d = d[:11]
    if not d:
        return ""
    if len(d) <= 2:
        return f"({d}" if d else ""
    if len(d) <= 7:
        return f"({d[:2]}) {d[2:]}"
    return f"({d[:2]}) {d[2:7]}-{d[7:]}"
