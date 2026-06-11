import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

type Profile = {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
  is_admin: boolean;
  clinical_slug?: string;
  active: boolean;
  user_count?: number;
};

type MenuRow = { menu_key: string; label: string; access_level: string };

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="top"><div class="page-title"><h1>Permissões</h1><p>Perfis de acesso e permissões por menu do sistema.</p></div></div>
@if(error){<div class="error">{{error}}</div>}

<div class="card grid grid-3">
  <div>
    <label>Perfil</label>
    <select [(ngModel)]="selectedProfileId" (ngModelChange)="loadPermissions()">
      @for(p of profiles; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
  <div class="form-actions">
    <button type="button" class="btn btn-secondary" (click)="openNewProfile()">Novo perfil</button>
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
          <select [(ngModel)]="r.access_level">
            <option value="hidden">Oculto</option>
            <option value="read">Somente consulta</option>
            <option value="write">Acesso total</option>
          </select>
        </td>
      </tr>
    }
  </table>
  <div class="form-actions"><button type="button" class="btn" (click)="savePermissions()">Salvar permissões</button></div>
</div>
}

<div class="card table-wrap">
  <h3>Perfis cadastrados</h3>
  <table>
    <tr><th>Nome</th><th>Slug</th><th>Clínico</th><th>Usuários</th><th>Sistema</th><th>Ações</th></tr>
    @for(p of profiles; track p.id){
      <tr>
        <td>{{p.name}}</td>
        <td>{{p.slug}}</td>
        <td>{{p.clinical_slug || '—'}}</td>
        <td>{{p.user_count ?? 0}}</td>
        <td>{{p.is_system ? 'Sim' : 'Não'}}</td>
        <td>
          @if(!p.is_admin && !p.is_system){
            <button type="button" class="btn btn-danger btn-sm" (click)="deleteProfile(p)">Excluir</button>
          }
        </td>
      </tr>
    }
  </table>
</div>

@if(profileModal){
<div class="modal-backdrop" (click)="profileModal=false"></div>
<div class="modal card">
  <h3>Novo perfil</h3>
  <div class="grid grid-2">
    <div><label>Nome</label><input [(ngModel)]="newProfile.name"></div>
    <div><label>Slug</label><input [(ngModel)]="newProfile.slug" placeholder="recepcao_vip"></div>
    <div>
      <label>Perfil clínico (opcional)</label>
      <select [(ngModel)]="newProfile.clinical_slug">
        <option [ngValue]="null">Nenhum</option>
        <option value="medico">Médico</option>
        <option value="enfermeira">Enfermagem</option>
        <option value="tecnica_enfermagem">Técnica</option>
      </select>
    </div>
  </div>
  <div class="form-actions">
    <button type="button" class="btn" (click)="createProfile()">Criar</button>
    <button type="button" class="btn btn-secondary" (click)="profileModal=false">Cancelar</button>
  </div>
</div>
}`,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 101; min-width: 320px; }
  `],
})
export class PermissionsComponent implements OnInit {
  profiles: Profile[] = [];
  selectedProfileId = 0;
  permissionRows: MenuRow[] = [];
  error = '';
  profileModal = false;
  newProfile = { name: '', slug: '', clinical_slug: null as string | null };

  constructor(private api: ApiService) {}

  get selectedProfile() {
    return this.profiles.find((p) => p.id === this.selectedProfileId);
  }

  ngOnInit() {
    this.loadProfiles();
  }

  loadProfiles() {
    this.api.get<Profile[]>('/profiles').subscribe({
      next: (r) => {
        this.profiles = r;
        if (!this.selectedProfileId && r.length) {
          this.selectedProfileId = r[0].id;
          this.loadPermissions();
        }
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar perfis'),
    });
  }

  loadPermissions() {
    if (!this.selectedProfileId) return;
    this.api.get<{ permissions: MenuRow[] }>(`/profiles/${this.selectedProfileId}/permissions`).subscribe({
      next: (r) => (this.permissionRows = r.permissions),
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar permissões'),
    });
  }

  savePermissions() {
    this.error = '';
    this.api.put(`/profiles/${this.selectedProfileId}/permissions`, {
      permissions: this.permissionRows.map((r) => ({
        menu_key: r.menu_key,
        access_level: r.access_level,
      })),
    }).subscribe({
      next: () => this.loadPermissions(),
      error: (e) => (this.error = e.error?.detail || 'Erro ao salvar'),
    });
  }

  openNewProfile() {
    this.newProfile = { name: '', slug: '', clinical_slug: null };
    this.profileModal = true;
  }

  createProfile() {
    this.api.post<Profile>('/profiles', this.newProfile).subscribe({
      next: (p) => {
        this.profileModal = false;
        this.loadProfiles();
        this.selectedProfileId = p.id;
        this.loadPermissions();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao criar perfil'),
    });
  }

  deleteProfile(p: Profile) {
    if (!confirm(`Excluir perfil ${p.name}?`)) return;
    this.api.delete(`/profiles/${p.id}`).subscribe({
      next: () => {
        this.selectedProfileId = 0;
        this.loadProfiles();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao excluir'),
    });
  }
}
