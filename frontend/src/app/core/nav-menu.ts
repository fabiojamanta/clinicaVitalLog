import { MenuItem } from './role-permissions';

export interface NavMenuLink {
  label: string;
  route: string;
  menuItem: MenuItem;
  exact?: boolean;
}

export interface NavMenuGroup {
  id: string;
  label: string;
  children: NavMenuLink[];
}

export type NavMenuEntry =
  | ({ type: 'link' } & NavMenuLink)
  | ({ type: 'group' } & NavMenuGroup);

export const NAV_MENU: NavMenuEntry[] = [
  { type: 'link', label: 'Dashboard', route: '/', menuItem: 'dashboard', exact: true },
  {
    type: 'group',
    id: 'cadastros',
    label: 'Cadastros',
    children: [
      { label: 'Fornecedores', route: '/fornecedores', menuItem: 'fornecedores' },
      { label: 'Clientes', route: '/clientes', menuItem: 'clientes' },
      { label: 'Produtos', route: '/produtos', menuItem: 'produtos' },
    ],
  },
  {
    type: 'group',
    id: 'movimentacao',
    label: 'Movimentação',
    children: [
      { label: 'Entrada', route: '/entradas', menuItem: 'entradas' },
      { label: 'Saída', route: '/saidas', menuItem: 'saidas' },
    ],
  },
  { type: 'link', label: 'Relatórios', route: '/relatorios', menuItem: 'relatorios' },
  {
    type: 'group',
    id: 'configuracoes',
    label: 'Configurações',
    children: [
      { label: 'Usuários', route: '/usuarios', menuItem: 'usuarios' },
      { label: 'Auditoria', route: '/auditoria', menuItem: 'auditoria' },
    ],
  },
  {
    type: 'group',
    id: 'atendimentos',
    label: 'Atendimentos',
    children: [
      { label: 'Consulta', route: '/atendimentos', menuItem: 'atendimentos' },
      { label: 'Pendentes', route: '/atendimentos-pendentes', menuItem: 'atendimentos_pendentes' },
    ],
  },
];

export function filterNavMenu(
  menu: NavMenuEntry[],
  canShow: (item: MenuItem) => boolean,
): NavMenuEntry[] {
  const result: NavMenuEntry[] = [];
  for (const entry of menu) {
    if (entry.type === 'link') {
      if (canShow(entry.menuItem)) result.push(entry);
      continue;
    }
    const hasVisibleChild = entry.children.some((child) => canShow(child.menuItem));
    if (hasVisibleChild) result.push(entry);
  }
  return result;
}

export function isRouteActive(url: string, route: string, exact = false): boolean {
  const path = url.split('?')[0];
  if (exact) return path === route || (route === '/' && path === '');
  return path === route || path.startsWith(`${route}/`);
}

export function isGroupActive(url: string, children: NavMenuLink[]): boolean {
  return children.some((child) => isRouteActive(url, child.route, child.exact));
}
