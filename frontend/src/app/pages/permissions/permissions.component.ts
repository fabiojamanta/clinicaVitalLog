import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { SuccessDialogComponent } from '../../shared/success-dialog.component';

type Profile = {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
  is_admin: boolean;
  clinical_slug?: string;
  active: boolean;
};

type MenuRow = { menu_key: string; label: string; access_level: string };

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, SuccessDialogComponent],
  template: `
<div class="top">
  <div class="page-title">
    <h1>Permissões</h1>
    <p>Configure o acesso por menu para cada perfil.</p>
  </div>
</div>
@if(error){<div class="error">{{error}}</div>}

<div class="card grid grid-3">
  <div>
    <label>Perfil</label>
    <select [(ngModel)]="selectedProfileId" (ngModelChange)="loadPermissions()">
      @for(p of profiles; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
</div>

@if(selectedProfile?.is_admin){
<div class="card"><p class="hint">Este perfil tem <strong>acesso total fixo</strong> — permissões não são configuráveis.</p></div>
}

@if(!selectedProfile?.is_admin && permissionRows.length){
<div class="card table-wrap">
  <table>
    <tr><th>Menu / Tela</th><th>Acesso</th></tr>
    @for(r of permissionRows; track r.menu_key){
      <tr>
        <td>{{r.label}}</td>
        <td>
          <select [(ngModel)]="r.access_level" [disabled]="!auth.canManagePermissions()">
            <option value="hidden">Oculto</option>
            <option value="read">Somente consulta</option>
            <option value="write">Acesso total</option>
          </select>
        </td>
      </tr>
    }
  </table>
  @if(auth.canManagePermissions()){
    <div class="form-actions"><button type="button" class="btn" (click)="savePermissions()">Salvar permissões</button></div>
  }
</div>
}

<app-success-dialog
  [open]="savedPopup"
  title="Salvo"
  message="Permissões salvas com sucesso."
  (close)="savedPopup = false"
></app-success-dialog>`,
})
export class PermissionsComponent implements OnInit {
  profiles: Profile[] = [];
  selectedProfileId = 0;
  permissionRows: MenuRow[] = [];
  savedPopup = false;
  error = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  get selectedProfile() {
    return this.profiles.find((p) => p.id === this.selectedProfileId);
  }

  ngOnInit() {
    this.loadProfiles();
  }

  loadProfiles() {
    this.api.get<Profile[]>('/profiles').subscribe({
      next: (r) => {
        this.profiles = r.filter((p) => p.active);
        if (!this.selectedProfileId && this.profiles.length) {
          this.selectedProfileId = this.profiles[0].id;
          this.loadPermissions();
        }
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao carregar perfis')),
    });
  }

  loadPermissions() {
    if (!this.selectedProfileId) return;
    this.api.get<{ permissions: MenuRow[] }>(`/profiles/${this.selectedProfileId}/permissions`).subscribe({
      next: (r) => (this.permissionRows = r.permissions),
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao carregar permissões')),
    });
  }

  savePermissions() {
    if (!this.auth.canManagePermissions()) return;
    this.error = '';
    this.api.put(`/profiles/${this.selectedProfileId}/permissions`, {
      permissions: this.permissionRows.map((r) => ({
        menu_key: r.menu_key,
        access_level: r.access_level,
      })),
    }).subscribe({
      next: () => {
        this.loadPermissions();
        this.savedPopup = true;
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar')),
    });
  }
}
