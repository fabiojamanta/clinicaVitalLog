import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { CpfCnpjBrPipe } from '../../core/cpf-cnpj.pipe';
import { PhoneBrPipe } from '../../core/phone-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { clientOptionLabel } from '../../core/search-select.util';
import { PAGE_LOGOS } from '../../shared/page-logos';
import { SkeletonTableComponent } from '../../shared/skeleton-table.component';

export type ReportColumn = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'badge' | 'cpfCnpj' | 'phone';
  badgeClass?: (row: Record<string, unknown>) => string;
};

export type ReportKind = 'estoque-atual' | 'vencimentos' | 'saidas' | 'fornecedores' | 'clientes' | 'produtos';

export type ReportConfig = {
  kind: ReportKind;
  title: string;
  description: string;
  apiPath: string;
  pdfKind: string;
  logoSrc?: string;
  columns: ReportColumn[];
};

const PRODUCT_TYPES = [
  { value: 'insumos', label: 'Insumos' },
  { value: 'homeopaticos', label: 'Homeopáticos' },
  { value: 'injetaveis', label: 'Injetáveis' },
  { value: 'V.O.', label: 'V.O.' },
];

const CLIENT_TYPES = [
  { value: 'paciente', label: 'Paciente' },
  { value: 'medico', label: 'Médico' },
  { value: 'setor_interno', label: 'Setor interno' },
  { value: 'funcionario', label: 'Funcionário' },
  { value: 'outro', label: 'Outro' },
];

const ACTIVE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Inativos' },
];

const REPORTS: Record<string, ReportConfig> = {
  'estoque-atual': {
    kind: 'estoque-atual',
    title: 'Estoque atual',
    description: 'Produtos, estoque consolidado por lote, mínimo e status.',
    apiPath: '/reports/estoque-atual',
    pdfKind: 'estoque-atual',
    columns: [
      { key: 'name', label: 'Produto' },
      { key: 'product_type', label: 'Tipo' },
      { key: 'current_stock', label: 'Estoque' },
      { key: 'minimum_stock', label: 'Mínimo' },
      { key: 'unit', label: 'Unidade' },
      {
        key: 'status',
        label: 'Status',
        type: 'badge',
        badgeClass: (r) => (r['status'] === 'BAIXO' ? 'danger' : 'ok'),
      },
    ],
  },
  vencimentos: {
    kind: 'vencimentos',
    title: 'Vencimentos',
    description: 'Lotes com saldo, validade, dias restantes e situação.',
    apiPath: '/reports/vencimentos',
    pdfKind: 'vencimentos',
    columns: [
      { key: 'product_name', label: 'Produto' },
      { key: 'lot_number', label: 'Lote' },
      { key: 'expiration_date', label: 'Validade', type: 'date' },
      { key: 'days_remaining', label: 'Dias restantes' },
      { key: 'current_stock', label: 'Quantidade' },
      {
        key: 'situation',
        label: 'Situação',
        type: 'badge',
        badgeClass: (r) => {
          const s = r['situation'];
          if (s === 'Vencido') return 'danger';
          if (s === 'A vencer') return 'warn';
          return 'ok';
        },
      },
    ],
  },
  saidas: {
    kind: 'saidas',
    title: 'Saídas',
    description: 'Histórico de retiradas por produto, lote e cliente.',
    apiPath: '/reports/saidas',
    pdfKind: 'saidas',
    columns: [
      { key: 'exit_date', label: 'Data', type: 'date' },
      { key: 'product_name', label: 'Produto' },
      { key: 'lot_number', label: 'Lote' },
      { key: 'client_name', label: 'Cliente' },
      { key: 'quantity', label: 'Quantidade' },
      { key: 'user_name', label: 'Registrado por' },
      { key: 'exit_type_label', label: 'Tipo' },
      { key: 'status', label: 'Status' },
      { key: 'reason', label: 'Motivo' },
    ],
  },
  fornecedores: {
    kind: 'fornecedores',
    title: 'Fornecedores',
    description: 'Lista de fornecedores com contato e produtos vinculados.',
    apiPath: '/reports/fornecedores',
    pdfKind: 'fornecedores',
    logoSrc: PAGE_LOGOS.fornecedor,
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'document', label: 'CPF/CNPJ', type: 'cpfCnpj' },
      { key: 'phone', label: 'Telefone', type: 'phone' },
      { key: 'email', label: 'Email' },
      { key: 'address', label: 'Endereço' },
      { key: 'products_count', label: 'Produtos' },
      {
        key: 'active',
        label: 'Ativo',
        type: 'badge',
        badgeClass: (r) => (r['active'] === 'Sim' ? 'ok' : 'danger'),
      },
    ],
  },
  clientes: {
    kind: 'clientes',
    title: 'Clientes',
    description: 'Clientes cadastrados por tipo e situação.',
    apiPath: '/reports/clientes',
    pdfKind: 'clientes',
    logoSrc: PAGE_LOGOS.cliente,
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'client_type_label', label: 'Tipo' },
      { key: 'document', label: 'CPF/CNPJ', type: 'cpfCnpj' },
      { key: 'phone', label: 'Telefone', type: 'phone' },
      { key: 'email', label: 'Email' },
      {
        key: 'active',
        label: 'Ativo',
        type: 'badge',
        badgeClass: (r) => (r['active'] === 'Sim' ? 'ok' : 'danger'),
      },
    ],
  },
  produtos: {
    kind: 'produtos',
    title: 'Produtos',
    description: 'Cadastro de produtos com fornecedor, estoque consolidado e alertas.',
    apiPath: '/reports/produtos',
    pdfKind: 'produtos',
    logoSrc: PAGE_LOGOS.produto,
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'product_type_label', label: 'Tipo' },
      { key: 'supplier_name', label: 'Fornecedor' },
      { key: 'barcode', label: 'Cód. barras' },
      { key: 'unit', label: 'Unidade' },
      { key: 'current_stock', label: 'Estoque' },
      { key: 'minimum_stock', label: 'Mínimo' },
      { key: 'expiration_alert_days', label: 'Alerta (dias)' },
      {
        key: 'stock_status',
        label: 'Status estoque',
        type: 'badge',
        badgeClass: (r) => (r['stock_status'] === 'BAIXO' ? 'danger' : 'ok'),
      },
      {
        key: 'active',
        label: 'Ativo',
        type: 'badge',
        badgeClass: (r) => (r['active'] === 'Sim' ? 'ok' : 'danger'),
      },
    ],
  },
};

@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DateBrPipe, CpfCnpjBrPipe, PhoneBrPipe, PageHeaderComponent, SearchSelectComponent],
  template: `
@if(config){
  <app-page-header
    [title]="config.title"
    [description]="config.description"
    [logoSrc]="config.logoSrc || ''"
    [logoAlt]="config.title"
  >
    <div class="actions">
      <a routerLink="/relatorios" class="btn btn-secondary">Voltar</a>
      <button type="button" class="btn" (click)="exportPdf()">Exportar PDF</button>
    </div>
  </app-page-header>
}
@if(error){<div class="error">{{ error }}</div>}
@if(config){
  <div class="card">
    <h3 style="margin:0 0 12px;font-size:16px">Filtros</h3>
    <div class="grid grid-3">
      @if(showProductFilter()){
        <div>
          <app-search-select
            fieldLabel="Produto"
            searchPath="/products"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.product_id"
            [filterMode]="true"
          ></app-search-select>
        </div>
      }
      @if(config.kind === 'estoque-atual'){
        <div>
          <label>Tipo de produto</label>
          <select [(ngModel)]="filters.product_type">
            <option value="">Todos</option>
            @for (t of productTypes; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
        <div>
          <label>Status do estoque</label>
          <select [(ngModel)]="filters.stock_status">
            <option value="">Todos</option>
            <option value="BAIXO">Estoque baixo</option>
            <option value="OK">OK</option>
          </select>
        </div>
      }
      @if(config.kind === 'vencimentos'){
        <div>
          <label>Situação</label>
          <select [(ngModel)]="filters.situation">
            <option value="">Todas</option>
            <option value="Vencido">Vencido</option>
            <option value="A vencer">A vencer</option>
            <option value="OK">OK</option>
          </select>
        </div>
        <div>
          <label>Validade a partir de</label>
          <input type="date" [(ngModel)]="filters.expiration_from">
        </div>
        <div>
          <label>Validade até</label>
          <input type="date" [(ngModel)]="filters.expiration_to">
        </div>
      }
      @if(config.kind === 'saidas'){
        <div>
          <app-search-select
            fieldLabel="Cliente"
            searchPath="/clients"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.client_id"
            [filterMode]="true"
            [labelFn]="clientOptionLabel"
          ></app-search-select>
        </div>
        <div>
          <label>Período — de</label>
          <input type="date" [(ngModel)]="filters.date_from">
        </div>
        <div>
          <label>Período — até</label>
          <input type="date" [(ngModel)]="filters.date_to">
        </div>
        <div>
          <label>Tipo de saída</label>
          <select [(ngModel)]="filters.exit_type">
            <option value="">Todos</option>
            <option value="consumo">Consumo</option>
            <option value="baixa_vencido">Baixa vencido</option>
          </select>
        </div>
        <div>
          <label>Status do movimento</label>
          <select [(ngModel)]="filters.status">
            <option value="">Todos</option>
            <option value="ativa">Ativa</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      }
      @if(config.kind === 'fornecedores'){
        <div>
          <app-search-select
            fieldLabel="Fornecedor"
            searchPath="/suppliers"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.supplier_id"
            [filterMode]="true"
          ></app-search-select>
        </div>
        <div>
          <label>Situação</label>
          <select [(ngModel)]="filters.active">
            @for (a of activeOptions; track a.value) {
              <option [value]="a.value">{{ a.label }}</option>
            }
          </select>
        </div>
      }
      @if(config.kind === 'clientes'){
        <div>
          <app-search-select
            fieldLabel="Cliente"
            searchPath="/clients"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.client_id"
            [filterMode]="true"
            [labelFn]="clientOptionLabel"
          ></app-search-select>
        </div>
        <div>
          <label>Tipo</label>
          <select [(ngModel)]="filters.client_type">
            <option value="">Todos</option>
            @for (t of clientTypes; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
        <div>
          <label>Situação</label>
          <select [(ngModel)]="filters.active">
            @for (a of activeOptions; track a.value) {
              <option [value]="a.value">{{ a.label }}</option>
            }
          </select>
        </div>
      }
      @if(config.kind === 'produtos'){
        <div>
          <app-search-select
            fieldLabel="Produto"
            searchPath="/products"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.product_id"
            [filterMode]="true"
          ></app-search-select>
        </div>
        <div>
          <label>Tipo de produto</label>
          <select [(ngModel)]="filters.product_type">
            <option value="">Todos</option>
            @for (t of productTypes; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
        </div>
        <div>
          <app-search-select
            fieldLabel="Fornecedor"
            searchPath="/suppliers"
            placeholder="Digite 3 letras, selecione na lista"
            [(ngModel)]="filters.supplier_id"
            [filterMode]="true"
          ></app-search-select>
        </div>
        <div>
          <label>Status do estoque</label>
          <select [(ngModel)]="filters.stock_status">
            <option value="">Todos</option>
            <option value="BAIXO">Estoque baixo</option>
            <option value="OK">OK</option>
          </select>
        </div>
        <div>
          <label>Situação</label>
          <select [(ngModel)]="filters.active">
            @for (a of activeOptions; track a.value) {
              <option [value]="a.value">{{ a.label }}</option>
            }
          </select>
        </div>
      }
    </div>
    <div class="form-actions">
      <button type="button" class="btn" (click)="applyFilters()">Aplicar filtros</button>
      <button type="button" class="btn btn-secondary" (click)="clearFilters()">Limpar</button>
    </div>
  </div>
}
@if(loading && config){<app-skeleton-table [columns]="config.columns.length" [rows]="8" />}
@if(!loading && config){
  <div class="card table-wrap">
    <p class="empty">Total de registros: <b>{{ rows.length }}</b></p>
    <table class="report-grid">
      <thead>
        <tr>
          @for (col of config.columns; track col.key) {
            <th scope="col">{{ col.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows; track trackRow($index, row)) {
          <tr>
            @for (col of config.columns; track col.key) {
              <td>
                @if (col.type === 'badge') {
                  <span class="badge" [class]="badgeClass(col, row)">{{ cellValue(row, col) }}</span>
                } @else if (col.type === 'date') {
                  {{ cellValue(row, col) | dateBr }}
                } @else if (col.type === 'cpfCnpj') {
                  {{ cellValue(row, col) | cpfCnpjBr }}
                } @else if (col.type === 'phone') {
                  {{ cellValue(row, col) | phoneBr }}
                } @else {
                  {{ cellValue(row, col) }}
                }
              </td>
            }
          </tr>
        } @empty {
          <tr>
            <td [attr.colspan]="config.columns.length" class="empty">Nenhum registro encontrado.</td>
          </tr>
        }
      </tbody>
    </table>
  </div>
}
`,
})
export class ReportViewComponent implements OnInit {
  readonly clientOptionLabel = clientOptionLabel;
  config: ReportConfig | null = null;
  rows: Record<string, unknown>[] = [];
  productTypes = PRODUCT_TYPES;
  clientTypes = CLIENT_TYPES;
  activeOptions = ACTIVE_OPTIONS;
  loading = false;
  error = '';

  filters = {
    product_id: 0,
    product_type: '',
    stock_status: '',
    situation: '',
    expiration_from: '',
    expiration_to: '',
    client_id: 0,
    date_from: '',
    date_to: '',
    exit_type: '',
    status: '',
    supplier_id: 0,
    active: '',
    client_type: '',
  };

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
  ) {}

  ngOnInit() {
    const kind = this.route.snapshot.paramMap.get('kind') || '';
    this.config = REPORTS[kind] ?? null;
    if (!this.config) {
      this.error = 'Relatório não encontrado';
      return;
    }
    this.load();
  }

  showProductFilter() {
    return this.config?.kind === 'estoque-atual' || this.config?.kind === 'vencimentos' || this.config?.kind === 'saidas';
  }

  queryParams(): Record<string, string | number> {
    const p: Record<string, string | number> = {};
    if (!this.config) return p;

    if (this.filters.product_id) p['product_id'] = this.filters.product_id;

    if (this.config.kind === 'estoque-atual') {
      if (this.filters.product_type) p['product_type'] = this.filters.product_type;
      if (this.filters.stock_status) p['stock_status'] = this.filters.stock_status;
    }
    if (this.config.kind === 'vencimentos') {
      if (this.filters.situation) p['situation'] = this.filters.situation;
      if (this.filters.expiration_from) p['expiration_from'] = this.filters.expiration_from;
      if (this.filters.expiration_to) p['expiration_to'] = this.filters.expiration_to;
    }
    if (this.config.kind === 'saidas') {
      if (this.filters.client_id) p['client_id'] = this.filters.client_id;
      if (this.filters.date_from) p['date_from'] = this.filters.date_from;
      if (this.filters.date_to) p['date_to'] = this.filters.date_to;
      if (this.filters.exit_type) p['exit_type'] = this.filters.exit_type;
      if (this.filters.status) p['status'] = this.filters.status;
    }
    if (this.config.kind === 'fornecedores') {
      if (this.filters.supplier_id) p['supplier_id'] = this.filters.supplier_id;
      if (this.filters.active) p['active'] = this.filters.active;
    }
    if (this.config.kind === 'clientes') {
      if (this.filters.client_id) p['client_id'] = this.filters.client_id;
      if (this.filters.client_type) p['client_type'] = this.filters.client_type;
      if (this.filters.active) p['active'] = this.filters.active;
    }
    if (this.config.kind === 'produtos') {
      if (this.filters.product_id) p['product_id'] = this.filters.product_id;
      if (this.filters.product_type) p['product_type'] = this.filters.product_type;
      if (this.filters.supplier_id) p['supplier_id'] = this.filters.supplier_id;
      if (this.filters.stock_status) p['stock_status'] = this.filters.stock_status;
      if (this.filters.active) p['active'] = this.filters.active;
    }
    return p;
  }

  applyFilters() {
    this.load();
  }

  clearFilters() {
    this.filters = {
      product_id: 0,
      product_type: '',
      stock_status: '',
      situation: '',
      expiration_from: '',
      expiration_to: '',
      client_id: 0,
      date_from: '',
      date_to: '',
      exit_type: '',
      status: '',
      supplier_id: 0,
      active: '',
      client_type: '',
    };
    this.load();
  }

  load() {
    if (!this.config) return;
    this.loading = true;
    this.error = '';
    this.api.get<Record<string, unknown>[]>(this.config.apiPath, this.queryParams()).subscribe({
      next: (data) => {
        this.rows = data;
        this.loading = false;
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar relatório');
        this.loading = false;
      },
    });
  }

  exportPdf() {
    if (!this.config) return;
    this.api.openPdf(`/reports/${this.config.pdfKind}.pdf`, this.queryParams());
  }

  trackRow(index: number, row: Record<string, unknown>) {
    return (row['id'] as number) ?? index;
  }

  cellValue(row: Record<string, unknown>, col: ReportColumn): string {
    const v = row[col.key];
    return v == null ? '' : String(v);
  }

  badgeClass(col: ReportColumn, row: Record<string, unknown>): string {
    return col.badgeClass ? col.badgeClass(row) : 'ok';
  }
}
