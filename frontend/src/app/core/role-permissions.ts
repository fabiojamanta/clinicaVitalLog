export type UserRole =
  | 'administrador'
  | 'estoque'
  | 'operacional'
  | 'consulta'
  | 'medico'
  | 'enfermeira'
  | 'tecnica_enfermagem';

export type MenuItem =
  | 'dashboard'
  | 'fornecedores'
  | 'clientes'
  | 'produtos'
  | 'entradas'
  | 'saidas'
  | 'atendimentos'
  | 'atendimentos_pendentes'
  | 'relatorios'
  | 'usuarios'
  | 'auditoria';

const ALL_ROLES: UserRole[] = [
  'administrador',
  'estoque',
  'operacional',
  'consulta',
  'medico',
  'enfermeira',
  'tecnica_enfermagem',
];

const ATTENDANCE_ROLES: UserRole[] = ['medico', 'enfermeira', 'tecnica_enfermagem'];
const PENDING_ATTENDANCE_ROLES: UserRole[] = ['enfermeira', 'tecnica_enfermagem'];

function hasRole(role: UserRole | null | undefined, allowed: UserRole[]): boolean {
  if (!role) return false;
  if (role === 'administrador') return true;
  return allowed.includes(role);
}

export function normalizeRole(value: unknown): UserRole | null {
  if (
    value === 'administrador' ||
    value === 'estoque' ||
    value === 'operacional' ||
    value === 'consulta' ||
    value === 'medico' ||
    value === 'enfermeira' ||
    value === 'tecnica_enfermagem'
  ) {
    return value;
  }
  return null;
}

export function canShowMenuItem(role: UserRole | null | undefined, item: MenuItem): boolean {
  switch (item) {
    case 'dashboard':
    case 'relatorios':
      return hasRole(role, ALL_ROLES);
    case 'fornecedores':
    case 'produtos':
      return hasRole(role, ['estoque', 'consulta']);
    case 'clientes':
      return hasRole(role, ['estoque', 'operacional', 'consulta']);
    case 'entradas':
      return hasRole(role, ['estoque']);
    case 'saidas':
      return hasRole(role, ['estoque', 'operacional', 'enfermeira', 'tecnica_enfermagem']);
    case 'atendimentos':
      return hasRole(role, ATTENDANCE_ROLES);
    case 'atendimentos_pendentes':
      return hasRole(role, PENDING_ATTENDANCE_ROLES);
    case 'usuarios':
    case 'auditoria':
      return hasRole(role, ['administrador']);
    default:
      return false;
  }
}

export function canAccessRoute(role: UserRole | null | undefined, path: string): boolean {
  const p = path.split('?')[0];
  if (p === '/' || p === '') return hasRole(role, ALL_ROLES);
  if (p.startsWith('/relatorios')) return hasRole(role, ALL_ROLES);
  if (p === '/fornecedores' || p === '/produtos') {
    return hasRole(role, ['estoque', 'consulta']);
  }
  if (p === '/clientes') {
    return hasRole(role, ['estoque', 'operacional', 'consulta']);
  }
  if (p === '/entradas') return hasRole(role, ['estoque']);
  if (p === '/saidas') return hasRole(role, ['estoque', 'operacional', 'enfermeira', 'tecnica_enfermagem']);
  if (p === '/atendimentos') return hasRole(role, ATTENDANCE_ROLES);
  if (p === '/atendimentos-pendentes') return hasRole(role, PENDING_ATTENDANCE_ROLES);
  if (p === '/usuarios' || p === '/auditoria') return hasRole(role, ['administrador']);
  return true;
}

export function canCreateSupplier(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canUpdateSupplier(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canCreateProduct(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canUpdateProduct(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canCreateClient(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque', 'operacional']);
}

export function canUpdateClient(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canCreateEntry(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canCreateExit(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque', 'operacional']);
}

export function canWriteOffExpired(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['estoque']);
}

export function canCancelExit(
  role: UserRole | null | undefined,
  exitUserId: number,
  currentUserId: number | null,
): boolean {
  if (!role || currentUserId == null) return false;
  if (role === 'administrador') return true;
  return exitUserId === currentUserId;
}

export function canCancelEntry(
  role: UserRole | null | undefined,
  entryUserId: number,
  currentUserId: number | null,
): boolean {
  if (!role || currentUserId == null) return false;
  if (role === 'administrador') return true;
  return entryUserId === currentUserId;
}

export function canAccessAttendance(role: UserRole | null | undefined): boolean {
  return hasRole(role, ATTENDANCE_ROLES);
}

export function canEditDoctorSection(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['medico']);
}

export function canEditTechSection(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['tecnica_enfermagem']);
}

export function canEditNursingSection(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['enfermeira']);
}

export function canDispenseMedication(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['enfermeira', 'tecnica_enfermagem']);
}

export function canViewPendingAttendances(role: UserRole | null | undefined): boolean {
  return hasRole(role, PENDING_ATTENDANCE_ROLES);
}

export function canManageUsers(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['administrador']);
}

export function canViewAudit(role: UserRole | null | undefined): boolean {
  return hasRole(role, ['administrador']);
}

export function isReadOnlyCadastro(role: UserRole | null | undefined): boolean {
  return role === 'consulta';
}

export function roleLabel(role: UserRole | null | undefined): string {
  switch (role) {
    case 'administrador':
      return 'Administrador';
    case 'estoque':
      return 'Estoque';
    case 'operacional':
      return 'Operacional';
    case 'consulta':
      return 'Consulta';
    case 'medico':
      return 'Médico';
    case 'enfermeira':
      return 'Enfermagem';
    case 'tecnica_enfermagem':
      return 'Técnica de enfermagem';
    default:
      return '';
  }
}
