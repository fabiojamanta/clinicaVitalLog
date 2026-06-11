import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  UserProfile,
  MenuItem,
  PermissionMap,
  canShowMenuItem,
  canAccessRoute,
  canCreateSupplier,
  canUpdateSupplier,
  canCreateProduct,
  canUpdateProduct,
  canCreateClient,
  canUpdateClient,
  canCreateEntry,
  canCreateExit,
  canWriteOffExpired,
  canCancelExit,
  canCancelEntry,
  canManageUsers,
  canViewAudit,
  canAccessAttendance,
  canEditDoctorSection,
  canEditTechSection,
  canEditNursingSection,
  canDispenseMedication,
  canCreateTreatment,
  canExecuteSession,
  canFinalizeSession,
  canViewPendingAttendances,
  canManageBookings,
  canEditVitals,
  canViewVitalsChart,
  canPrintExternalPrescription,
  canManagePermissions,
  isReadOnlyMenu,
  canWriteMenu,
  canReadMenu,
  roleLabel,
} from '../core/role-permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private permissions: PermissionMap = {};
  private profile: UserProfile | null = null;
  private sessionActive = false;

  constructor(
    private http: HttpClient,
    private api: ApiService,
  ) {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || '{}');
      this.profile = u.profile ?? null;
      this.permissions = u.permissions ?? {};
      this.sessionActive = !!u.id;
    } catch {
      this.profile = null;
      this.permissions = {};
      this.sessionActive = false;
    }
  }

  isAuthenticated() {
    return this.sessionActive;
  }

  /** @deprecated tokens are HttpOnly cookies */
  getToken() {
    return null;
  }

  login(email: string, password: string) {
    return this.http
      .post<any>(`${this.api.base}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(
        tap((r) => {
          sessionStorage.setItem('user', JSON.stringify(r.user));
          this.profile = r.user.profile ?? null;
          this.permissions = r.user.permissions ?? {};
          this.sessionActive = true;
        }),
      );
  }

  refreshMe() {
    return this.http.get<any>(`${this.api.base}/auth/me`, { withCredentials: true }).pipe(
      tap((u) => {
        const stored = { ...this.user(), ...u };
        sessionStorage.setItem('user', JSON.stringify(stored));
        this.profile = u.profile ?? null;
        this.permissions = u.permissions ?? {};
        this.sessionActive = true;
      }),
    );
  }

  hydrateFromUser(u: { id?: number; profile?: UserProfile; permissions?: PermissionMap }) {
    sessionStorage.setItem('user', JSON.stringify(u));
    this.profile = u.profile ?? null;
    this.permissions = u.permissions ?? {};
    this.sessionActive = !!u.id;
  }

  tryRestoreSession() {
    return this.http.get<any>(`${this.api.base}/auth/me`, { withCredentials: true }).pipe(
      tap((u) => this.hydrateFromUser(u)),
    );
  }

  logout() {
    return this.http.post(`${this.api.base}/auth/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        sessionStorage.removeItem('user');
        this.profile = null;
        this.permissions = {};
        this.sessionActive = false;
      }),
    );
  }

  clearLocalSession() {
    sessionStorage.removeItem('user');
    this.profile = null;
    this.permissions = {};
    this.sessionActive = false;
  }

  user(): { id?: number; name?: string; email?: string; profile?: UserProfile; permissions?: PermissionMap } {
    try {
      return JSON.parse(sessionStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  userProfile(): UserProfile | null {
    return this.profile;
  }

  userId(): number | null {
    const id = this.user().id;
    return typeof id === 'number' ? id : null;
  }

  isAdmin() {
    return !!this.profile?.is_admin;
  }

  roleDisplay() {
    return roleLabel(this.profile);
  }

  /** @deprecated use roleDisplay() */
  role() {
    return this.profile?.slug ?? null;
  }

  canShowMenuItem(item: MenuItem) {
    return canShowMenuItem(this.profile, this.permissions, item);
  }

  canAccessRoute(path: string) {
    return canAccessRoute(this.profile, this.permissions, path);
  }

  canWriteMenu(item: MenuItem) {
    return canWriteMenu(this.profile, this.permissions, item);
  }

  canReadMenu(item: MenuItem) {
    return canReadMenu(this.profile, this.permissions, item);
  }

  isReadOnlyMenu(item: MenuItem) {
    return isReadOnlyMenu(this.profile, this.permissions, item);
  }

  canCreateSupplier() { return canCreateSupplier(this.profile, this.permissions); }
  canUpdateSupplier() { return canUpdateSupplier(this.profile, this.permissions); }
  canCreateProduct() { return canCreateProduct(this.profile, this.permissions); }
  canUpdateProduct() { return canUpdateProduct(this.profile, this.permissions); }
  canCreateClient() { return canCreateClient(this.profile, this.permissions); }
  canUpdateClient() { return canUpdateClient(this.profile, this.permissions); }
  canCreateEntry() { return canCreateEntry(this.profile, this.permissions); }
  canCreateExit() { return canCreateExit(this.profile, this.permissions); }
  canWriteOffExpired() { return canWriteOffExpired(this.profile, this.permissions); }
  canCancelExit(exitUserId: number) { return canCancelExit(this.profile, this.permissions, exitUserId, this.userId()); }
  canCancelEntry(entryUserId: number) { return canCancelEntry(this.profile, this.permissions, entryUserId, this.userId()); }
  canManageUsers() { return canManageUsers(this.profile, this.permissions); }
  canViewAudit() { return canViewAudit(this.profile, this.permissions); }
  canAccessAttendance() { return canAccessAttendance(this.profile, this.permissions); }
  canEditDoctorSection() { return canEditDoctorSection(this.profile, this.permissions); }
  canEditTechSection() { return canEditTechSection(this.profile, this.permissions); }
  canEditNursingSection() { return canEditNursingSection(this.profile, this.permissions); }
  canDispenseMedication() { return canDispenseMedication(this.profile, this.permissions); }
  canCreateTreatment() { return canCreateTreatment(this.profile, this.permissions); }
  canExecuteSession() { return canExecuteSession(this.profile, this.permissions); }
  canFinalizeSession() { return canFinalizeSession(this.profile, this.permissions); }
  canViewPendingAttendances() { return canViewPendingAttendances(this.profile, this.permissions); }
  canManageBookings() { return canManageBookings(this.profile, this.permissions); }
  canEditVitals() { return canEditVitals(this.profile, this.permissions); }
  canViewVitalsChart() { return canViewVitalsChart(this.profile, this.permissions); }
  canPrintExternalPrescription() { return canPrintExternalPrescription(this.profile, this.permissions); }
  canManagePermissions() { return canManagePermissions(this.profile); }

  isReadOnlyCadastro(menu: MenuItem = 'fornecedores') {
    return isReadOnlyMenu(this.profile, this.permissions, menu);
  }
}
