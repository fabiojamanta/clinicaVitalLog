import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { FormModalComponent } from '../../shared/form-modal.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { PAGE_LOGOS } from '../../shared/page-logos';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, FormModalComponent, SearchSelectComponent],
  template: `
<app-page-header
  title="Produtos"
  description="Cadastro técnico dos produtos e regras de alerta."
  [logoSrc]="logo"
  logoAlt="Produtos"
>
  @if(auth.canCreateProduct()){
    <button type="button" class="btn" (click)="openNew()">Incluir</button>
  }
</app-page-header>
@if(error && !modalOpen){<div class="error">{{error}}</div>}
@if(auth.isReadOnlyMenu('produtos')){<div class="readonly-banner">Acesso somente consulta nesta tela. Inclusão e alteração não estão disponíveis.</div>}

<app-form-modal [open]="modalOpen" [title]="modalTitle()" (close)="closeModal()">
  @if(error){<div class="error">{{error}}</div>}
  <div class="grid grid-3">
    <div><label>Nome</label><input [(ngModel)]="form.name"></div>
    <div>
      <app-search-select
        fieldLabel="Fornecedor"
        searchPath="/suppliers"
        placeholder="Digite o nome do fornecedor"
        [ngModel]="form.supplier_id ?? 0"
        (ngModelChange)="form.supplier_id = $event || null"
        [initialLabel]="supplierInitialLabel"
      ></app-search-select>
    </div>
    <div><label>Código de barras</label><input [(ngModel)]="form.barcode"></div>
    <div><label>Tipo</label>
      <select [(ngModel)]="form.product_type">
        <option value="insumos">Insumos</option>
        <option value="homeopaticos">Homeopáticos</option>
        <option value="injetaveis">Injetáveis</option>
        <option value="V.O.">V.O.</option>
      </select>
    </div>
    <div><label>Unidade</label><input [(ngModel)]="form.unit"></div>
    <div><label>Estoque mínimo</label><input type="number" [(ngModel)]="form.minimum_stock"></div>
    <div><label>Alerta vencimento em dias</label><input type="number" [(ngModel)]="form.expiration_alert_days"></div>
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
      <tr><th>Nome</th><th>Fornecedor</th><th>Cód. barras</th><th>Tipo</th><th>Estoque</th><th>Mínimo</th><th>Alerta vencimento</th></tr>
    </thead>
    <tbody>
      @for(i of rows; track i.id){
        <tr
          [class.clickable]="auth.canUpdateProduct()"
          [class.selected]="modalOpen && editingId===i.id"
          (click)="auth.canUpdateProduct() && edit(i)"
        >
          <td>{{i.name}}</td>
          <td>{{i.supplier_name||'-'}}</td>
          <td>{{i.barcode||'-'}}</td>
          <td>{{i.product_type}}</td>
          <td><span class="badge" [class.danger]="i.total_stock <= i.minimum_stock" [class.ok]="i.total_stock > i.minimum_stock">{{i.total_stock}}</span></td>
          <td>{{i.minimum_stock}}</td>
          <td>{{i.expiration_alert_days}} dias</td>
        </tr>
      }
    </tbody>
  </table>
</div>`,
})
export class ProductsComponent implements OnInit {
  logo = PAGE_LOGOS.produto;
  rows: any[] = [];
  editingId: number | null = null;
  modalOpen = false;
  supplierInitialLabel = '';
  error = '';
  form: any = {
    name: '',
    supplier_id: null,
    barcode: '',
    product_type: 'insumos',
    minimum_stock: 0,
    expiration_alert_days: 30,
    unit: 'un',
    notes: '',
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
    return this.editingId ? 'Editar produto' : 'Incluir produto';
  }

  load() {
    this.api.get<any[]>('/products').subscribe((r) => (this.rows = r));
  }

  openNew() {
    this.resetForm();
    this.modalOpen = true;
  }

  edit(row: any) {
    if (!this.auth.canUpdateProduct()) return;
    this.editingId = row.id;
    this.supplierInitialLabel = row.supplier_name ?? '';
    this.form = {
      name: row.name ?? '',
      supplier_id: row.supplier_id ?? null,
      barcode: row.barcode ?? '',
      product_type: row.product_type ?? 'insumos',
      minimum_stock: row.minimum_stock ?? 0,
      expiration_alert_days: row.expiration_alert_days ?? 30,
      unit: row.unit ?? 'un',
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
    this.supplierInitialLabel = '';
    this.form = {
      name: '',
      supplier_id: null,
      barcode: '',
      product_type: 'insumos',
      minimum_stock: 0,
      expiration_alert_days: 30,
      unit: 'un',
      notes: '',
      active: true,
    };
    this.error = '';
  }

  save() {
    if (this.editingId ? !this.auth.canUpdateProduct() : !this.auth.canCreateProduct()) return;
    this.error = '';
    const payload = { ...this.form };
    const req = this.editingId
      ? this.api.put(`/products/${this.editingId}`, payload)
      : this.api.post('/products', payload);
    req.subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar produto')),
    });
  }
}
