import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import {
  UserRole,
  MenuItem,
  normalizeRole,
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
  isReadOnlyCadastro,
  roleLabel,
} from '../core/role-permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(
    private http: HttpClient,
    private api: ApiService,
  ) {}

  isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  getToken() {
    return localStorage.getItem('token');
  }

  login(email: string, password: string) {
    return this.http.post<any>(`${this.api.base}/auth/login`, { email, password }).pipe(
      tap((r) => {
        localStorage.setItem('token', r.access_token);
        localStorage.setItem('user', JSON.stringify(r.user));
      }),
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  user(): { id?: number; name?: string; email?: string; role?: string } {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  role(): UserRole | null {
    return normalizeRole(this.user().role);
  }

  userId(): number | null {
    const id = this.user().id;
    return typeof id === 'number' ? id : null;
  }

  isAdmin() {
    return this.role() === 'administrador';
  }

  roleDisplay() {
    return roleLabel(this.role());
  }

  canShowMenuItem(item: MenuItem) {
    return canShowMenuItem(this.role(), item);
  }

  canAccessRoute(path: string) {
    return canAccessRoute(this.role(), path);
  }

  canCreateSupplier() {
    return canCreateSupplier(this.role());
  }

  canUpdateSupplier() {
    return canUpdateSupplier(this.role());
  }

  canCreateProduct() {
    return canCreateProduct(this.role());
  }

  canUpdateProduct() {
    return canUpdateProduct(this.role());
  }

  canCreateClient() {
    return canCreateClient(this.role());
  }

  canUpdateClient() {
    return canUpdateClient(this.role());
  }

  canCreateEntry() {
    return canCreateEntry(this.role());
  }

  canCreateExit() {
    return canCreateExit(this.role());
  }

  canWriteOffExpired() {
    return canWriteOffExpired(this.role());
  }

  canCancelExit(exitUserId: number) {
    return canCancelExit(this.role(), exitUserId, this.userId());
  }

  canCancelEntry(entryUserId: number) {
    return canCancelEntry(this.role(), entryUserId, this.userId());
  }

  canManageUsers() {
    return canManageUsers(this.role());
  }

  canViewAudit() {
    return canViewAudit(this.role());
  }

  canAccessAttendance() {
    return canAccessAttendance(this.role());
  }

  canEditDoctorSection() {
    return canEditDoctorSection(this.role());
  }

  canEditTechSection() {
    return canEditTechSection(this.role());
  }

  canEditNursingSection() {
    return canEditNursingSection(this.role());
  }

  canDispenseMedication() {
    return canDispenseMedication(this.role());
  }

  canCreateTreatment() {
    return canCreateTreatment(this.role());
  }

  canExecuteSession() {
    return canExecuteSession(this.role());
  }

  canFinalizeSession() {
    return canFinalizeSession(this.role());
  }

  canViewPendingAttendances() {
    return canViewPendingAttendances(this.role());
  }

  isReadOnlyCadastro() {
    return isReadOnlyCadastro(this.role());
  }
}
