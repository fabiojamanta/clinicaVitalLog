/** Fonte única de rotas protegidas — novas telas: adicionar entrada aqui. */
export interface AppRouteEntry {
  menuKey: string;
  label: string;
  path: string;
  navGroup?: 'cadastros' | 'movimentacao' | 'atendimentos' | 'configuracoes';
  exact?: boolean;
  public?: boolean;
}

export const PUBLIC_ROUTES: AppRouteEntry[] = [
  { menuKey: '_login', label: 'Login', path: '/login', public: true },
  { menuKey: '_assinar', label: 'Assinatura', path: '/assinar/:token', public: true },
];

export const PROTECTED_ROUTES: AppRouteEntry[] = [
  { menuKey: 'dashboard', label: 'Dashboard', path: '/', exact: true },
  { menuKey: 'fornecedores', label: 'Fornecedores', path: '/fornecedores', navGroup: 'cadastros' },
  { menuKey: 'clientes', label: 'Clientes', path: '/clientes', navGroup: 'cadastros' },
  { menuKey: 'produtos', label: 'Produtos', path: '/produtos', navGroup: 'cadastros' },
  { menuKey: 'entradas', label: 'Entrada', path: '/entradas', navGroup: 'movimentacao' },
  { menuKey: 'saidas', label: 'Saída', path: '/saidas', navGroup: 'movimentacao' },
  { menuKey: 'reservas', label: 'Reservas', path: '/reservas', navGroup: 'atendimentos' },
  { menuKey: 'atendimentos', label: 'Consulta', path: '/atendimentos', navGroup: 'atendimentos' },
  { menuKey: 'atendimentos_pendentes', label: 'Pendências', path: '/atendimentos-pendentes', navGroup: 'atendimentos' },
  { menuKey: 'atendimentos', label: 'Sessão', path: '/sessoes/:id' },
  { menuKey: 'relatorios', label: 'Relatórios', path: '/relatorios' },
  { menuKey: 'relatorios', label: 'Relatório', path: '/relatorios/:kind' },
  { menuKey: 'usuarios', label: 'Usuários', path: '/usuarios', navGroup: 'configuracoes' },
  { menuKey: 'auditoria', label: 'Auditoria', path: '/auditoria', navGroup: 'configuracoes' },
];

export function menuKeyForPath(urlPath: string): string | null {
  const p = urlPath.split('?')[0];
  if (p.startsWith('/sessoes/')) return 'atendimentos';
  if (p.startsWith('/relatorios/')) return 'relatorios';
  const exact = PROTECTED_ROUTES.find((r) => r.exact && (p === r.path || (r.path === '/' && p === '')));
  if (exact) return exact.menuKey;
  const match = PROTECTED_ROUTES.filter((r) => !r.exact && p.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return match?.menuKey ?? null;
}
