import type { AttendanceSection } from './attendance.types';
import type { SessionSection } from '../treatment-session/treatment-session.types';

export function workflowLabel(status: string) {
  switch (status) {
    case 'aguardando_sinais_vitais':
      return 'Aguardando sinais vitais';
    case 'aguardando_medico':
      return 'Aguardando médico';
    case 'aguardando_tecnica':
      return 'Aguardando técnica';
    case 'aguardando_enfermagem':
      return 'Aguardando enfermagem';
    case 'concluido':
      return 'Concluído';
    default:
      return status;
  }
}

export function sessionStatusLabel(status: string) {
  switch (status) {
    case 'pendente':
      return 'Pendente';
    case 'aguardando_enfermagem':
      return 'Aguard. enfermagem';
    case 'concluido':
      return 'Concluída';
    default:
      return status;
  }
}

export function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function bookingStatusLabel(s: string) {
  switch (s) {
    case 'agendado':
      return 'Agendado';
    case 'presente':
      return 'Presente';
    case 'cancelado':
      return 'Cancelado';
    default:
      return s;
  }
}

export function paymentMethodLabel(m: string) {
  switch (m) {
    case 'pix':
      return 'PIX';
    case 'dinheiro':
      return 'Dinheiro';
    case 'cartao':
      return 'Cartão';
    case 'transferencia':
      return 'Transferência';
    default:
      return m;
  }
}

export function summary(text?: string) {
  const s = (text || '').trim();
  return s.length > 60 ? `${s.slice(0, 60)}…` : s || '—';
}

export function pendingSectionForAction(action: string): AttendanceSection {
  switch (action) {
    case 'registrar_sinais_vitais':
      return 'sinais-vitais';
    case 'dispensar':
      return 'dispensar';
    case 'finalizar':
      return 'finalizar';
    case 'tecnica':
      return 'tecnica';
    default:
      return 'medico';
  }
}

export function sessionSectionForAction(action: string): SessionSection {
  switch (action) {
    case 'aplicar_sessao':
      return 'aplicacao';
    case 'finalizar_sessao':
      return 'enfermagem';
    default:
      return 'resumo';
  }
}
