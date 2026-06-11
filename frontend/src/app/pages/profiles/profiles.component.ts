import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FormModalComponent } from '../../shared/form-modal.component';

type Profile = {
  id: number;
  name: string;
  slug: string;
  is_system: boolean;
  is_admin: boolean;
  clinical_slug?: string | null;
  active: boolean;
  user_count?: number;
};

@Component({
  selector: 'app-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalComponent],
  template: `
<div class="top">
  <div class="page-head">
    <div class="page-title">
      <h1 class="title-gradient">Perfis</h1>
      <p>Cadastro de perfis de acesso do sistema.</p>
    </div>
  </div>
  @if(auth.canManagePermissions()){
    <button type="button" class="btn" (click)="openNew()">Incluir</button>
  }
</div>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

@if(auth.canManagePermissions()){
<app-form-modal [open]="modalOpen" [title]="modalTitle()" (close)="closeModal()">
  @if(error){<div class="error">{{error}}</div>}
  <div class="grid grid-2">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div>
      <label>Slug</label>
      <input [(ngModel)]="form.slug" placeholder="recepcao_vip" [readonly]="editing?.is_system">
    </div>
    <div>
      <label>Perfil clínico (opcional)</label>
      <select [(ngModel)]="form.clinical_slug">
        <option [ngValue]="null">Nenhum</option>
        <option value="medico">Médico</option>
        <option value="enfermeira">Enfermagem</option>
        <option value="tecnica_enfermagem">Técnica</option>
      </select>
    </div>
    <div>
      <label>Ativo</label>
      <select [(ngModel)]="form.active" [disabled]="!!editing?.is_admin">
        <option [ngValue]="true">Sim</option>
        <option [ngValue]="false">Não</option>
      </select>
    </div>
    <div class="form-actions">
      <button type="button" class="btn" (click)="save()">Salvar</button>
      <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
    </div>
  </div>
</app-form-modal>
}

<div class="card table-wrap">
  <table>
    <thead>
      <tr>
        <th>Nome</th>
        <th>Slug</th>
        <th>Clínico</th>
        <th>Usuários</th>
        <th>Sistema</th>
        <th>Ativo</th>
        @if(auth.canManagePermissions()){<th>Ações</th>}
      </tr>
    </thead>
    <tbody>
      @for(p of rows; track p.id){
        <tr
          class="clickable"
          [class.selected]="modalOpen && editing?.id === p.id"
          (click)="edit(p)"
        >
          <td>{{p.name}}</td>
          <td>{{p.slug}}</td>
          <td>{{clinicalLabel(p.clinical_slug)}}</td>
          <td>{{p.user_count ?? 0}}</td>
          <td>{{p.is_system ? 'Sim' : 'Não'}}</td>
          <td>
            <span class="badge" [class.ok]="p.active" [class.danger]="!p.active">
              {{p.active ? 'Sim' : 'Não'}}
            </span>
          </td>
          @if(auth.canManagePermissions()){
            <td (click)="$event.stopPropagation()">
              @if(!p.is_admin && !p.is_system){
                <button type="button" class="btn btn-danger btn-sm" (click)="deleteProfile(p)">Excluir</button>
              }
            </td>
          }
        </tr>
      }
    </tbody>
  </table>
</div>`,
})
export class ProfilesComponent implements OnInit {
  rows: Profile[] = [];
  editing: Profile | null = null;
  modalOpen = false;
  error = '';
  form = { name: '', slug: '', clinical_slug: null as string | null, active: true };

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  modalTitle() {
    return this.editing ? 'Editar perfil' : 'Incluir perfil';
  }

  clinicalLabel(slug?: string | null) {
    if (!slug) return '—';
    const labels: Record<string, string> = {
      medico: 'Médico',
      enfermeira: 'Enfermagem',
      tecnica_enfermagem: 'Técnica',
    };
    return labels[slug] ?? slug;
  }

  load() {
    this.api.get<Profile[]>('/profiles').subscribe({
      next: (r) => (this.rows = r),
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar perfis'),
    });
  }

  openNew() {
    if (!this.auth.canManagePermissions()) return;
    this.editing = null;
    this.form = { name: '', slug: '', clinical_slug: null, active: true };
    this.error = '';
    this.modalOpen = true;
  }

  edit(row: Profile) {
    if (!this.auth.canManagePermissions() || row.is_admin) return;
    this.editing = row;
    this.form = {
      name: row.name,
      slug: row.slug,
      clinical_slug: row.clinical_slug ?? null,
      active: row.active,
    };
    this.error = '';
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
    this.editing = null;
    this.error = '';
  }

  save() {
    if (!this.auth.canManagePermissions()) return;
    this.error = '';
    if (!this.form.name.trim()) {
      this.error = 'Informe o nome do perfil';
      return;
    }
    if (!this.form.slug.trim()) {
      this.error = 'Informe o slug do perfil';
      return;
    }
    const payload = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim().toLowerCase(),
      clinical_slug: this.form.clinical_slug,
      active: this.form.active,
    };
    const req = this.editing
      ? this.api.put(`/profiles/${this.editing.id}`, payload)
      : this.api.post<Profile>('/profiles', payload);
    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao salvar perfil'),
    });
  }

  deleteProfile(p: Profile) {
    if (!this.auth.canManagePermissions()) return;
    if (!confirm(`Excluir perfil ${p.name}?`)) return;
    this.api.delete(`/profiles/${p.id}`).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = e.error?.detail || 'Erro ao excluir perfil'),
    });
  }
}
