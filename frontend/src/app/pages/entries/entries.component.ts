import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SearchSelectComponent } from '../../shared/search-select.component';

@Component({
  selector: 'app-entries',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, ReadonlyBannerComponent, SearchSelectComponent],
  template: `
<div class="top"><div class="page-title"><h1>Entradas de estoque</h1><p>Registre entrada de produto informando lote e validade.</p></div></div>
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('entradas')"></app-readonly-banner>
@if(success){<div class="success-box">
  {{success}}
  @if(lastEntryId){<div class="form-actions" style="margin-top:10px"><button type="button" class="btn btn-secondary" (click)="printLabel(lastEntryId)">Imprimir etiqueta</button></div>}
</div>}
@if(auth.canCreateEntry()){
<div class="card grid grid-3">
  <div>
    <app-search-select
      fieldLabel="Produto"
      searchPath="/products"
      placeholder="Digite o nome do produto"
      [(ngModel)]="form.product_id"
      (itemSelected)="onProductSelected($event)"
      (ngModelChange)="onProductIdChange($event)"
    ></app-search-select>
    @if(form.product_id && selectedProduct){
      @if(!selectedProduct.supplier_id){<div class="hint danger">Produto sem fornecedor. Vá em Produtos e selecione o fornecedor antes de registrar entrada.</div>}
      @else{<div class="hint">Fornecedor do produto: <b>{{selectedProduct.supplier_name}}</b></div>}
    }
  </div>
  <div><label>Lote (código)</label><input [(ngModel)]="form.lot_number"></div>
  <div><label>Validade</label><input type="date" [(ngModel)]="form.expiration_date"></div>
  <div><label>Data</label><input type="date" [(ngModel)]="form.entry_date"></div>
  <div><label>Quantidade</label><input type="number" [(ngModel)]="form.quantity"></div>
  <div><label>Observações</label><input [(ngModel)]="form.notes"></div>
  <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
</div>
}
<div class="card table-wrap">
  <table>
    <thead>
      <tr><th>Código</th><th>Data</th><th>Produto</th><th>Fornecedor</th><th>Lote</th><th>Validade</th><th>Qtd</th><th>Saldo lote</th><th>Status</th><th></th></tr>
    </thead>
    <tbody>
      @for(i of rows;track i.id){
        <tr>
          <td><b>{{i.entry_code}}</b></td>
          <td>{{i.entry_date | dateBr}}</td>
          <td>{{i.product_name}}</td>
          <td>{{i.supplier_name}}</td>
          <td>{{i.lot_number}}</td>
          <td>{{i.expiration_date | dateBr}}</td>
          <td>{{i.quantity}}</td>
          <td>{{i.lot_current_stock}}</td>
          <td><span class="badge" [class.ok]="entryStatus(i)==='ativa'" [class.danger]="entryStatus(i)==='cancelada'">{{ entryStatusLabel(i) }}</span></td>
          <td class="actions">
            @if(entryStatus(i)==='ativa'){<button type="button" class="btn btn-secondary btn-sm" (click)="printLabel(i.id)">Etiqueta</button>}
            @if(entryStatus(i)==='ativa' && auth.canCancelEntry(i.user_id)){
              <button type="button" class="btn btn-danger btn-sm" (click)="cancel(i.id)">Cancelar</button>
            }
          </td>
        </tr>
      }
    </tbody>
  </table>
</div>`,
})
export class EntriesComponent implements OnInit {
  rows: any[] = [];
  selectedProduct: any = null;
  error = '';
  success = '';
  lastEntryId: number | null = null;
  form: any = {
    product_id: 0,
    lot_number: '',
    expiration_date: '',
    entry_date: todayIsoBr(),
    quantity: 1,
    notes: '',
  };

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  onProductSelected(product: Record<string, unknown>) {
    this.selectedProduct = product;
  }

  onProductIdChange(id: number | null) {
    if (!id) this.selectedProduct = null;
  }

  load() {
    this.api.get<any[]>('/entries').subscribe((r) => (this.rows = r));
  }

  printLabel(entryId: number) {
    this.api.openPdf(`/entries/${entryId}/label.pdf`);
  }

  entryStatus(row: { status?: string }) {
    return row.status || 'ativa';
  }

  entryStatusLabel(row: { status?: string }) {
    return this.entryStatus(row) === 'cancelada' ? 'Cancelada' : 'Ativa';
  }

  cancel(id: number) {
    const row = this.rows.find((r) => r.id === id);
    if (!row || this.entryStatus(row) !== 'ativa' || !this.auth.canCancelEntry(row.user_id)) return;
    const cancel_reason = prompt('Informe o motivo do cancelamento da entrada:');
    if (!cancel_reason?.trim()) return;
    this.error = '';
    this.api.post(`/entries/${id}/cancel`, { cancel_reason: cancel_reason.trim() }).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao cancelar entrada')),
    });
  }

  save() {
    if (!this.auth.canCreateEntry()) return;
    this.error = '';
    this.success = '';
    this.lastEntryId = null;
    this.api.post<any>('/entries', this.form).subscribe({
      next: (res) => {
        this.lastEntryId = res.id;
        this.success = `Entrada registrada. Código: ${res.entry_code} — estoque do lote ${res.lot_number}: ${res.lot_current_stock} un.`;
        this.form = {
          product_id: 0,
          lot_number: '',
          expiration_date: '',
          entry_date: todayIsoBr(),
          quantity: 1,
          notes: '',
        };
        this.selectedProduct = null;
        this.load();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao registrar entrada')),
    });
  }
}
