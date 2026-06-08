/** Data de hoje no fuso de Brasília, formato yyyy-MM-dd (para inputs type="date" e API). */
export function todayIsoBr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
