export const patientSearchParams = {
  client_type: 'paciente',
  active_only: true,
};

export function clientOptionLabel(item: Record<string, unknown>): string {
  return `${item['name']} · ${item['client_type']}`;
}
