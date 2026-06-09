import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';

const WRITE_OFF_CLIENT_NAME = 'Baixa de estoque / Descarte';

type EntryLookup = {
  entry_code: string;
  product_id: number;
  product_name: string;
  lot_id: number;
  lot_number: string;
  expiration_date: string;
  quantity: number;
  lot_current_stock: number;
  expired: boolean;
};

@Component({
  selector: 'app-exits',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe],
  template: `
<div class="top"><div class="page-title"><h1>Saídas de estoque</h1><p>Controle de retirada por cliente, produto e lote.</p></div></div>
@if(error){<div class="error">{{error}}</div>}
@if(auth.canCreateExit()){
<div class="card grid grid-3">
  <div><label>Código da entrada</label><input #entryCodeInput [(ngModel)]="entryCode" placeholder="ENT0100000001" (keydown.enter)="lookupEntryCode()">
    <div class="form-actions"><button type="button" class="btn btn-secondary" (click)="lookupEntryCode()">Buscar código</button></div>
  </div>
  @if(auth.canWriteOffExpired()){
  <div>
    <label>Apenas produtos Vencidos</label>
    <select [(ngModel)]="expiredOnly" (ngModelChange)="onExpiredOnlyChange()">
      <option value="nao">Não</option>
      <option value="sim">Sim</option>
    </select>
    @if(writeOffMode){<div class="hint">Exibe somente produtos e lotes vencidos com saldo. Motivo obrigatório.</div>}
  </div>
  }
  <div><label>Produto</label><select [(ngModel)]="form.product_id" (ngModelChange)="onProductChange($event)"><option [ngValue]="0">Selecione</option>@for(p of productsForSelect;track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
  <div><label>Lote</label><select [(ngModel)]="form.lot_id" (ngModelChange)="onLotChange()"><option [ngValue]="0">Selecione</option>@for(l of filteredLots;track l.id){<option [ngValue]="l.id">Lote {{l.lot_number}} · val {{l.expiration_date | dateBr}}@if(l.expired){ (vencido)}</option>}</select></div>
  <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
  <div><label>Data Saída</label><input type="date" [(ngModel)]="form.exit_date"></div>
  <div><label>Cliente</label><select [(ngModel)]="form.client_id"><option [ngValue]="0">Selecione</option>@for(c of clients;track c.id){<option [ngValue]="c.id">{{c.name}} · {{c.client_type}}</option>}</select></div>
  <div><label>Quantidade</label><input type="number" [(ngModel)]="form.quantity"></div>
  <div><label>Motivo</label><input [(ngModel)]="form.reason" [placeholder]="writeOffMode ? 'Obrigatório para baixa' : ''"></div>
  <div class="form-actions"><button type="button" class="btn" (click)="save()">Salvar</button></div>
</div>
}
@if(selectedEntry){
  <div class="card entry-selected-card" [class.entry-selected-expired]="selectedEntry.expired">
    <p class="entry-selected-title">Produto selecionado</p>
    <p class="entry-selected-product">{{ selectedEntry.product_name }}</p>
    <p class="entry-selected-meta">Lote: {{ selectedEntry.lot_number }}</p>
    <p class="entry-selected-meta">Validade: {{ selectedEntry.expiration_date | dateBr }}</p>
    <p class="entry-selected-meta">Saldo: {{ selectedEntry.lot_current_stock }}</p>
    @if(selectedEntry.expired){<p class="entry-selected-meta"><span class="badge danger">Vencido</span></p>}
  </div>
}
<div class="card table-wrap">
  <table>
    <tr><th>Data</th><th>Tipo</th><th>Produto</th><th>Lote</th><th>Cliente</th><th>Qtd</th><th>Registrado por</th><th>Status</th><th>Ações</th></tr>
    @for(i of rows;track i.id){
      <tr>
        <td>{{i.exit_date | dateBr}}</td>
        <td>@if(i.exit_type==='baixa_vencido'){<span class="badge warn">Baixa vencido</span>}@else{<span class="badge ok">Consumo</span>}</td>
        <td>{{i.product_name}}</td>
        <td>{{i.lot_number}}</td>
        <td>{{i.client_name}}</td>
        <td>{{i.quantity}}</td>
        <td>{{i.user_name || '—'}}</td>
        <td><span class="badge" [class.ok]="i.status==='ativa'" [class.danger]="i.status==='cancelada'">{{i.status}}</span></td>
        <td>@if(i.status==='ativa' && auth.canCancelExit(i.user_id)){<button type="button" class="btn btn-danger btn-sm" (click)="cancel(i.id)">Cancelar</button>}</td>
      </tr>
    }
  </table>
</div>`,
})
export class ExitsComponent implements OnInit, AfterViewInit {
  @ViewChild('entryCodeInput') entryCodeInput?: ElementRef<HTMLInputElement>;
  rows: any[] = [];
  allProducts: any[] = [];
  productsForSelect: any[] = [];
  clients: any[] = [];
  lots: any[] = [];
  error = '';
  entryCode = '';
  selectedEntry: EntryLookup | null = null;
  expiredOnly: 'nao' | 'sim' = 'nao';
  writeOffClientId = 0;

  get writeOffMode() {
    return this.expiredOnly === 'sim';
  }
  form: any = {
    product_id: 0,
    lot_id: 0,
    client_id: 0,
    exit_date: todayIsoBr(),
    quantity: 1,
    reason: '',
    notes: '',
    exit_type: 'consumo',
  };

  constructor(
    private api: ApiService,
    public auth: AuthService,
  ) {}

  get filteredLots() {
    if (!this.form.product_id) return [];
    return this.lots.filter((l) => l.product_id === this.form.product_id);
  }

  get selectedLotStock(): number | null {
    if (!this.form.lot_id) return null;
    const lot = this.lots.find((l) => l.id === this.form.lot_id);
    if (lot != null) return lot.current_stock;
    const entry = this.selectedEntry;
    if (entry && entry.lot_id === this.form.lot_id) return entry.lot_current_stock;
    return null;
  }

  ngOnInit() {
    if (!this.auth.canWriteOffExpired() && this.expiredOnly === 'sim') {
      this.expiredOnly = 'nao';
      this.form.exit_type = 'consumo';
    }
    this.loadAll();
  }

  ngAfterViewInit() {
    this.focusEntryCode();
  }

  private focusEntryCode() {
    setTimeout(() => this.entryCodeInput?.nativeElement?.focus(), 0);
  }

  loadLots() {
    const path = this.writeOffMode ? '/lots?expired_only=true' : '/lots';
    this.api.get<any[]>(path).subscribe((r) => {
      this.lots = r;
      this.syncProductsForSelect();
      this.ensureValidSelection();
      this.focusEntryCode();
    });
  }

  syncProductsForSelect() {
    if (this.writeOffMode) {
      const ids = new Set(this.lots.map((l) => l.product_id));
      this.productsForSelect = this.allProducts.filter((p) => ids.has(p.id));
    } else {
      this.productsForSelect = this.allProducts;
    }
  }

  ensureValidSelection() {
    if (this.form.product_id && !this.productsForSelect.some((p) => p.id === this.form.product_id)) {
      this.form.product_id = 0;
      this.form.lot_id = 0;
    }
    if (this.form.lot_id && !this.filteredLots.some((l) => l.id === this.form.lot_id)) {
      this.form.lot_id = 0;
    }
  }

  loadAll() {
    this.api.get<any[]>('/exits').subscribe((r) => (this.rows = r));
    this.api.get<any[]>('/products').subscribe((r) => {
      this.allProducts = r;
      this.syncProductsForSelect();
    });
    this.api.get<any[]>('/clients').subscribe((r) => {
      this.clients = r;
      const wo = r.find((c) => c.name === WRITE_OFF_CLIENT_NAME);
      this.writeOffClientId = wo?.id || 0;
      if (this.writeOffMode && this.writeOffClientId) {
        this.form.client_id = this.writeOffClientId;
      }
    });
    this.loadLots();
  }

  onExpiredOnlyChange() {
    this.selectedEntry = null;
    this.form.exit_type = this.writeOffMode ? 'baixa_vencido' : 'consumo';
    this.form.product_id = 0;
    this.form.lot_id = 0;
    this.entryCode = '';
    if (this.writeOffMode && this.writeOffClientId) {
      this.form.client_id = this.writeOffClientId;
    } else if (!this.writeOffMode) {
      this.form.client_id = 0;
    }
    this.loadLots();
  }

  private applyLotsAndSelect(lots: any[], entry: EntryLookup) {
    this.lots = lots;
    this.syncProductsForSelect();
    this.form.product_id = entry.product_id;
    this.form.lot_id = entry.lot_id;
    this.ensureValidSelection();
  }

  private enableWriteOffMode() {
    this.expiredOnly = 'sim';
    this.form.exit_type = 'baixa_vencido';
    if (this.writeOffClientId) {
      this.form.client_id = this.writeOffClientId;
    }
  }

  lookupEntryCode() {
    this.error = '';
    const code = this.entryCode.trim();
    if (!code) return;
    this.api.get<EntryLookup>(`/entries/by-code/${encodeURIComponent(code)}`).subscribe({
      next: (entry) => {
        this.selectedEntry = entry;
        if (entry.expired) {
          if (this.auth.canWriteOffExpired()) {
            this.enableWriteOffMode();
            this.api.get<any[]>('/lots?expired_only=true').subscribe((lots) => {
              this.applyLotsAndSelect(lots, entry);
            });
            return;
          }
          this.error =
            'Produto vencido. Baixa de vencido disponível apenas para perfis Estoque ou Administrador.';
          this.expiredOnly = 'nao';
          this.form.exit_type = 'consumo';
          return;
        }
        this.form.product_id = entry.product_id;
        this.form.lot_id = entry.lot_id;
        if (this.expiredOnly === 'sim' && !this.filteredLots.some((l) => l.id === entry.lot_id)) {
          this.expiredOnly = 'nao';
          this.form.exit_type = 'consumo';
          this.form.client_id = 0;
          this.api.get<any[]>('/lots').subscribe((lots) => this.applyLotsAndSelect(lots, entry));
        } else {
          this.ensureValidSelection();
        }
      },
      error: (e) => {
        this.selectedEntry = null;
        this.error = e.error?.detail || 'Código de entrada não encontrado';
      },
    });
  }

  onProductChange(_id: number) {
    this.form.lot_id = 0;
    this.selectedEntry = null;
    this.entryCode = '';
  }

  onLotChange() {
    this.selectedEntry = null;
    this.entryCode = '';
  }

  save() {
    if (!this.auth.canCreateExit()) return;
    if (this.writeOffMode && !this.auth.canWriteOffExpired()) {
      this.error = 'Baixa de produto vencido não permitida para seu perfil';
      return;
    }
    this.error = '';
    if (this.writeOffMode && !this.form.reason?.trim()) {
      this.error = 'Informe o motivo da baixa de produto vencido';
      return;
    }
    const payload = { ...this.form, exit_type: this.writeOffMode ? 'baixa_vencido' : 'consumo' };
    this.api.post('/exits', payload).subscribe({
      next: () => {
        this.form = {
          product_id: 0,
          lot_id: 0,
          client_id: this.writeOffMode && this.writeOffClientId ? this.writeOffClientId : 0,
          exit_date: todayIsoBr(),
          quantity: 1,
          reason: '',
          notes: '',
          exit_type: this.writeOffMode ? 'baixa_vencido' : 'consumo',
        };
        this.entryCode = '';
        this.selectedEntry = null;
        this.loadAll();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao registrar saída'),
    });
  }

  cancel(id: number) {
    const row = this.rows.find((r) => r.id === id);
    if (row && !this.auth.canCancelExit(row.user_id)) return;
    const cancel_reason = prompt('Informe o motivo do cancelamento:');
    if (!cancel_reason) return;
    this.api.post(`/exits/${id}/cancel`, { cancel_reason }).subscribe({
      next: () => this.loadAll(),
      error: (e) => (this.error = e.error?.detail || 'Erro ao cancelar'),
    });
  }
}
