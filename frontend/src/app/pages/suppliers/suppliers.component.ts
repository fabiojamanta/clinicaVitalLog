import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';
import { PAGE_LOGOS } from '../../shared/page-logos';
import { CpfCnpjBrPipe } from '../../core/cpf-cnpj.pipe';
import { PhoneBrPipe } from '../../core/phone-br.pipe';
import { formatCpfCnpj, formatPhoneBr, stripDigits } from '../../core/format.util';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, FormModalComponent, CpfCnpjBrPipe, PhoneBrPipe],
  template: `
<app-page-header
  title="Fornecedores"
  description="Cadastro de fornecedores da clínica."
  [logoSrc]="logo"
  logoAlt="Fornecedores"
>
  @if(auth.canCreateSupplier()){
    <button type="button" class="btn" (click)="openNew()">Incluir</button>
  }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}
@if(auth.isReadOnlyCadastro()){<div class="readonly-banner">Perfil Consulta: visualização apenas. Cadastro e edição não estão disponíveis.</div>}

<app-form-modal [open]="modalOpen" [title]="modalTitle()" (close)="closeModal()">
  @if(error){<div class="error">{{error}}</div>}
  <div class="grid grid-3">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div><label>CPF/CNPJ</label><input [ngModel]="form.document" (ngModelChange)="onDocumentChange($event)" inputmode="numeric" placeholder="000.000.000-00 ou 00.000.000/0000-00"></div>
    <div><label>Telefone</label><input [ngModel]="form.phone" (ngModelChange)="onPhoneChange($event)" inputmode="tel" placeholder="(00) 00000-0000"></div>
    <div><label>Email</label><input [(ngModel)]="form.email"></div>
    <div><label>Endereço</label><input [(ngModel)]="form.address"></div>
    <div><label>Observações</label><input [(ngModel)]="form.notes"></div>
    <div class="form-actions">
      <button type="button" class="btn" (click)="save()">Salvar</button>
      <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
    </div>
  </div>
</app-form-modal>

<div class="card table-wrap">
  <table>
    <thead>
      <tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>Email</th></tr>
    </thead>
    <tbody>
      @for(i of rows; track i.id){
        <tr
          [class.clickable]="auth.canUpdateSupplier()"
          [class.selected]="modalOpen && editingId===i.id"
          (click)="auth.canUpdateSupplier() && edit(i)"
        >
          <td>{{i.name}}</td>
          <td>{{i.document | cpfCnpjBr}}</td>
          <td>{{i.phone | phoneBr}}</td>
          <td>{{i.email}}</td>
        </tr>
      }
    </tbody>
  </table>
</div>`,
})
export class SuppliersComponent implements OnInit {
  logo = PAGE_LOGOS.fornecedor;
  rows: any[] = [];
  editingId: number | null = null;
  modalOpen = false;
  error = '';
  form: any = { name: '', document: '', phone: '', email: '', address: '', notes: '', active: true };

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  modalTitle() {
    return this.editingId ? 'Editar fornecedor' : 'Incluir fornecedor';
  }

  load() {
    this.api.get<any[]>('/suppliers').subscribe((r) => (this.rows = r));
  }

  openNew() {
    this.resetForm();
    this.modalOpen = true;
  }

  edit(row: any) {
    if (!this.auth.canUpdateSupplier()) return;
    this.editingId = row.id;
    this.form = {
      name: row.name ?? '',
      document: formatCpfCnpj(row.document),
      phone: formatPhoneBr(row.phone),
      email: row.email ?? '',
      address: row.address ?? '',
      notes: row.notes ?? '',
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
    this.form = { name: '', document: '', phone: '', email: '', address: '', notes: '', active: true };
    this.error = '';
  }

  onDocumentChange(value: string) {
    this.form.document = formatCpfCnpj(value);
  }

  onPhoneChange(value: string) {
    this.form.phone = formatPhoneBr(value);
  }

  save() {
    if (this.editingId ? !this.auth.canUpdateSupplier() : !this.auth.canCreateSupplier()) return;
    this.error = '';
    const payload = {
      ...this.form,
      document: stripDigits(this.form.document) || null,
      phone: stripDigits(this.form.phone) || null,
    };
    const req = this.editingId
      ? this.api.put(`/suppliers/${this.editingId}`, payload)
      : this.api.post('/suppliers', payload);
    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao salvar fornecedor'),
    });
  }
}
