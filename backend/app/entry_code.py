"""Códigos de entrada compatíveis com Code 128 (conjunto B: A-Z, 0-9).

Use o valor de `entry_code` como conteúdo da etiqueta em impressoras/software
que geram Code 128 (ex.: Zebra, Bartender, bibliotecas jsbarcode/code128).
"""

import re

# Apenas caracteres válidos no Code 128 subset B (alfanumérico ASCII)
_CODE128_PATTERN = re.compile(r"^[A-Z0-9]+$")


def generate_entry_code(clinic_id: int, entry_id: int) -> str:
    """Formato: ENT + clínica (2 dígitos) + id da entrada (8 dígitos).

    Exemplo: ENT0100000042 — 13 caracteres, sem símbolos.
    """
    return f"ENT{clinic_id:02d}{entry_id:08d}"


def normalize_entry_code(raw: str) -> str:
    """Normaliza leitura de scanner ou digitação (formato novo ou legado ENT-1-000042)."""
    s = raw.strip().upper().replace(" ", "")
    legacy = re.match(r"^ENT-(\d+)-(\d+)$", s)
    if legacy:
        return generate_entry_code(int(legacy.group(1)), int(legacy.group(2)))
    return re.sub(r"[^A-Z0-9]", "", s)


def is_valid_entry_code_format(code: str) -> bool:
    return bool(code and _CODE128_PATTERN.match(code))
