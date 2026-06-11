import { menuKeyForPath } from './route-registry';

export type AccessLevel = 'hidden' | 'read' | 'write';

export type UserProfile = {
  id: number;
  name: string;
  slug: string;
  is_admin: boolean;
  clinical_slug?: string | null;
};

export type MenuItem =
  | 'dashboard'
  | 'fornecedores'
  | 'clientes'
  | 'produtos'
  | 'entradas'
  | 'saidas'
  | 'reservas'
  | 'atendimentos'
  | 'atendimentos_pendentes'
  | 'relatorios'
  | 'usuarios'
  | 'auditoria';

export type PermissionMap = Partial<Record<MenuItem, AccessLevel>>;

function isAdmin(profile: UserProfile | null | undefined): boolean {
  return !!profile?.is_admin;
}

function level(profile: UserProfile | null | undefined, perms: PermissionMap, menu: MenuItem): AccessLevel {
  if (isAdmin(profile)) return 'write';
  return perms[menu] ?? 'hidden';
}

export function canShowMenuItem(
  profile: UserProfile | null | undefined,
  perms: PermissionMap,
  item: MenuItem,
): boolean {
  return level(profile, perms, item) !== 'hidden';
}

export function canReadMenu(
  profile: UserProfile | null | undefined,
  perms: PermissionMap,
  item: MenuItem,
): boolean {
  const l = level(profile, perms, item);
  return l === 'read' || l === 'write';
}

export function canWriteMenu(
  profile: UserProfile | null | undefined,
  perms: PermissionMap,
  item: MenuItem,
): boolean {
  return level(profile, perms, item) === 'write';
}

export function isReadOnlyMenu(
  profile: UserProfile | null | undefined,
  perms: PermissionMap,
  item: MenuItem,
): boolean {
  if (isAdmin(profile)) return false;
  return level(profile, perms, item) === 'read';
}

export function canAccessRoute(
  profile: UserProfile | null | undefined,
  perms: PermissionMap,
  path: string,
): boolean {
  const p = path.split('?')[0];
  if (p === '/permissoes') return isAdmin(profile);
  const mk = menuKeyForPath(p);
  if (!mk) return true;
  return canShowMenuItem(profile, perms, mk as MenuItem);
}

export function canCreateSupplier(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'fornecedores');
}
export function canUpdateSupplier(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'fornecedores');
}
export function canCreateProduct(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'produtos');
}
export function canUpdateProduct(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'produtos');
}
export function canCreateClient(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'clientes');
}
export function canUpdateClient(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'clientes');
}
export function canCreateEntry(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'entradas');
}
export function canCreateExit(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'saidas');
}
export function canWriteOffExpired(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'saidas');
}
export function canCancelExit(p: UserProfile | null, perms: PermissionMap, exitUserId: number, currentUserId: number | null) {
  if (!p || currentUserId == null) return false;
  if (isAdmin(p)) return true;
  return exitUserId === currentUserId && canWriteMenu(p, perms, 'saidas');
}
export function canCancelEntry(p: UserProfile | null, perms: PermissionMap, entryUserId: number, currentUserId: number | null) {
  if (!p || currentUserId == null) return false;
  if (isAdmin(p)) return true;
  return entryUserId === currentUserId && canWriteMenu(p, perms, 'entradas');
}
export function canAccessAttendance(p: UserProfile | null, perms: PermissionMap) {
  return canShowMenuItem(p, perms, 'atendimentos');
}
export function canEditDoctorSection(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'medico');
}
export function canEditTechSection(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'tecnica_enfermagem');
}
export function canEditNursingSection(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'enfermeira');
}
export function canDispenseMedication(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'enfermeira' || p?.clinical_slug === 'tecnica_enfermagem');
}
export function canCreateTreatment(p: UserProfile | null, perms: PermissionMap) {
  return canEditDoctorSection(p, perms);
}
export function canExecuteSession(p: UserProfile | null, perms: PermissionMap) {
  return canDispenseMedication(p, perms);
}
export function canFinalizeSession(p: UserProfile | null, perms: PermissionMap) {
  return canEditNursingSection(p, perms);
}
export function canViewPendingAttendances(p: UserProfile | null, perms: PermissionMap) {
  return canShowMenuItem(p, perms, 'atendimentos_pendentes');
}
export function canManageBookings(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'reservas');
}
export function canEditVitals(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'enfermeira');
}
export function canViewVitalsChart(p: UserProfile | null, perms: PermissionMap) {
  return canReadMenu(p, perms, 'atendimentos') && (isAdmin(p) || p?.clinical_slug === 'medico' || p?.clinical_slug === 'enfermeira');
}
export function canPrintExternalPrescription(p: UserProfile | null, perms: PermissionMap) {
  return canEditDoctorSection(p, perms);
}
export function canManageUsers(p: UserProfile | null, perms: PermissionMap) {
  return canWriteMenu(p, perms, 'usuarios');
}
export function canViewAudit(p: UserProfile | null, perms: PermissionMap) {
  return canReadMenu(p, perms, 'auditoria');
}
export function canManagePermissions(p: UserProfile | null) {
  return isAdmin(p);
}
export function isReadOnlyCadastro(p: UserProfile | null, perms: PermissionMap, menu: MenuItem) {
  return isReadOnlyMenu(p, perms, menu);
}

export function roleLabel(profile: UserProfile | null | undefined): string {
  return profile?.name ?? '';
}
