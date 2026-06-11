export const patientSearchParams = {
  client_type: 'paciente',
  active_only: true,
};

/** Filtros — inclui pacientes inativos e não dispara reload ao digitar. */
export const patientFilterParams = {
  client_type: 'paciente',
};

export function clientOptionLabel(item: Record<string, unknown>): string {
  return `${item['name']} · ${item['client_type']}`;
}
