/** Remove tudo que não for dígito. */
export function stripDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/** CPF (11) ou CNPJ (14) conforme quantidade de dígitos. */
export function formatCpfCnpj(value: string | null | undefined): string {
  const d = stripDigits(value).slice(0, 14);
  if (!d) return '';

  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Celular: (XX) XXXXX-XXXX (11 dígitos). */
export function formatPhoneBr(value: string | null | undefined): string {
  const d = stripDigits(value).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return d.length === 2 ? `(${d})` : `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
