"""Datas/horas no fuso de Brasília (America/Sao_Paulo)."""
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

BR_TZ = ZoneInfo("America/Sao_Paulo")


def now_br() -> datetime:
    """Agora em Brasília, sem tzinfo (compatível com SQLite)."""
    return datetime.now(BR_TZ).replace(tzinfo=None)


def today_br() -> date:
    return datetime.now(BR_TZ).date()


def assume_brasilia(dt: datetime) -> datetime:
    """Interpreta datetime ingênuo do banco como horário de Brasília."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=BR_TZ)
    return dt.astimezone(BR_TZ)


def format_datetime_br_iso(dt: datetime | None) -> str | None:
    """Serializa para a API com offset -03:00 (ou -02:00 no horário de verão)."""
    if dt is None:
        return None
    return assume_brasilia(dt).isoformat()


def parse_filter_datetime(value: str | None, *, end: bool = False) -> datetime | None:
    """Interpreta filtro de período: só data (YYYY-MM-DD) ou data+hora (datetime-local / ISO)."""
    if not value:
        return None
    raw = value.strip()
    if len(raw) == 10:
        try:
            d = date.fromisoformat(raw)
            return datetime.combine(d, time.max if end else time.min)
        except ValueError:
            return None
    try:
        normalized = raw.replace(" ", "T")[:19]
        if len(normalized) == 16:
            normalized += ":00"
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None
