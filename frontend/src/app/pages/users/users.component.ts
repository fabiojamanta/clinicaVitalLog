import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { FormModalComponent } from '../../shared/form-modal.component';
import { PhoneBrPipe } from '../../core/phone-br.pipe';
import { formatPhoneBr, stripDigits } from '../../core/format.util';

const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  estoque: 'Estoque',
  operacional: 'Operacional',
  consulta: 'Consulta',
  medico: 'Médico',
  enfermeira: 'Enfermagem',
  tecnica_enfermagem: 'Técnica de enfermagem',
  vendedor: 'Vendedor',
};

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, FormModalComponent, PhoneBrPipe],
  template: `
<div class="top">
  <div class="page-head">
    <div class="page-title">
      <h1 class="title-gradient">Usuários</h1>
      <p>Cadastro de acesso e perfis do sistema.</p>
    </div>
  </div>
  <button type="button" class="btn" (click)="openNew()">Incluir</button>
</div>
@if(error && !modalOpen){<div class="error">{{error}}</div>}

<app-form-modal [open]="modalOpen" [title]="modalTitle()" (close)="closeModal()">
  @if(error){<div class="error">{{error}}</div>}
  <div class="grid grid-3">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>Email</label><input [(ngModel)]="form.email" type="email"></div>
    <div><label>Cargo</label><input [(ngModel)]="form.cargo" placeholder="Ex.: Gerente de estoque"></div>
    <div>
      <label>Telefone</label>
      <input
        [ngModel]="form.phone"
        (ngModelChange)="onPhoneChange($event)"
        inputmode="tel"
        placeholder="(11) 97604-1558"
      >
    </div>
    <div>
      <label>Senha</label>
      <input type="password" [(ngModel)]="form.password" [placeholder]="editingId ? 'Deixe em branco para manter' : 'Obrigatória'">
    </div>
    <div>
      <label>Perfil</label>
      <select [(ngModel)]="form.role">
        <option value="administrador">Administrador</option>
        <option value="estoque">Estoque</option>
        <option value="operacional">Operacional</option>
        <option value="consulta">Consulta</option>
        <option value="medico">Médico</option>
        <option value="enfermeira">Enfermagem</option>
        <option value="tecnica_enfermagem">Técnica de enfermagem</option>
        <option value="vendedor">Vendedor</option>
      </select>
    </div>
    <div>
      <label>Ativo</label>
      <select [(ngModel)]="form.active">
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

<div class="card table-wrap">
  <table>
    <thead>
      <tr><th>Nome</th><th>Email</th><th>Cargo</th><th>Telefone</th><th>Perfil</th><th>Ativo</th></tr>
    </thead>
    <tbody>
      @for(i of rows; track i.id){
        <tr
          class="clickable"
          [class.selected]="modalOpen && editingId===i.id"
          (click)="edit(i)"
        >
          <td>{{i.name}}</td>
          <td>{{i.email}}</td>
          <td>{{i.cargo || '—'}}</td>
          <td>{{i.phone | phoneBr}}</td>
          <td>{{roleLabel(i.role)}}</td>
          <td><span class="badge" [class.ok]="i.active" [class.danger]="!i.active">{{i.active ? 'Sim' : 'Não'}}</span></td>
        </tr>
      }
    </tbody>
  </table>
</div>`,
})
export class UsersComponent implements OnInit {
  rows: any[] = [];
  editingId: number | null = null;
  modalOpen = false;
  error = '';
  form: any = {
    name: '',
    email: '',
    cargo: '',
    phone: '',
    password: '',
    role: 'operacional',
    active: true,
  };

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  modalTitle() {
    return this.editingId ? 'Editar usuário' : 'Incluir usuário';
  }

  roleLabel(role: string) {
    return ROLE_LABELS[role] || role;
  }

  onPhoneChange(value: string) {
    this.form.phone = formatPhoneBr(value);
  }

  load() {
    this.api.get<any[]>('/users').subscribe((r) => (this.rows = r));
  }

  openNew() {
    this.resetForm();
    this.modalOpen = true;
  }

  edit(row: any) {
    this.editingId = row.id;
    this.form = {
      name: row.name ?? '',
      email: row.email ?? '',
      cargo: row.cargo ?? '',
      phone: formatPhoneBr(row.phone),
      password: '',
      role: row.role ?? 'operacional',
      active: row.active ?? true,
    };
    this.error = '';
    this.modalOpen = true;
  }

  closeModal() {
    this.modalOpen = false;
    this.resetForm();
  }

  resetForm() {
    this.editingId = null;
    this.form = {
      name: '',
      email: '',
      cargo: '',
      phone: '',
      password: '',
      role: 'operacional',
      active: true,
    };
    this.error = '';
  }

  save() {
    this.error = '';
    if (!this.editingId && !this.form.password?.trim()) {
      this.error = 'Informe a senha do novo usuário';
      return;
    }
    const payload = {
      name: this.form.name,
      email: this.form.email,
      cargo: this.form.cargo?.trim() || null,
      phone: stripDigits(this.form.phone) || null,
      role: this.form.role,
      active: this.form.active,
      password: this.form.password?.trim() || null,
    };
    const req = this.editingId
      ? this.api.put(`/users/${this.editingId}`, payload)
      : this.api.post('/users', { ...payload, password: this.form.password });
    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao salvar usuário'),
    });
  }
}
