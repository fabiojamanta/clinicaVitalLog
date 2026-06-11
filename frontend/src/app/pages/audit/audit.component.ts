import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { SkeletonTableComponent } from '../../shared/skeleton-table.component';

const ACTION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'login', label: 'Login' },
  { value: 'create', label: 'Criação' },
  { value: 'update', label: 'Alteração' },
  { value: 'stock_entry', label: 'Entrada de estoque' },
  { value: 'stock_exit', label: 'Saída de estoque' },
  { value: 'stock_write_off', label: 'Baixa vencido' },
  { value: 'cancel_stock_exit', label: 'Cancelamento de saída' },
  { value: 'cancel_stock_entry', label: 'Cancelamento de entrada' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'users', label: 'Usuários' },
  { value: 'suppliers', label: 'Fornecedores' },
  { value: 'clients', label: 'Clientes' },
  { value: 'products', label: 'Produtos' },
  { value: 'stock_entries', label: 'Entradas' },
  { value: 'stock_exits', label: 'Saídas' },
];

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, SkeletonTableComponent],
  template: `
<div class="top"><div class="page-title"><h1 class="title-gradient">Auditoria</h1><p>Registro de ações, alterações, entradas, saídas e cancelamentos.</p></div></div>
@if(error){<div class="error">{{ error }}</div>}
<div class="card">
  <h3 class="dash-section-title">Filtros</h3>
  <div class="grid grid-3">
    <div>
      <label>Usuário</label>
      <select [(ngModel)]="filters.user_id">
        <option [ngValue]="0">Todos</option>
        @for (u of users; track u.id) {
          <option [ngValue]="u.id">{{ u.name }}</option>
        }
      </select>
    </div>
    <div>
      <label>Ação</label>
      <select [(ngModel)]="filters.action">
        @for (a of actionOptions; track a.value) {
          <option [value]="a.value">{{ a.label }}</option>
        }
      </select>
    </div>
    <div>
      <label>Entidade</label>
      <select [(ngModel)]="filters.entity">
        @for (e of entityOptions; track e.value) {
          <option [value]="e.value">{{ e.label }}</option>
        }
      </select>
    </div>
    <div>
      <label>ID do registro</label>
      <input type="number" min="0" [(ngModel)]="filters.entity_id" placeholder="Ex.: 42">
    </div>
    <div>
      <label>Período — de (data e hora)</label>
      <input type="datetime-local" [(ngModel)]="filters.date_from" step="60">
    </div>
    <div>
      <label>Período — até (data e hora)</label>
      <input type="datetime-local" [(ngModel)]="filters.date_to" step="60">
    </div>
  </div>
  <div class="form-actions">
    <button type="button" class="btn" (click)="applyFilters()">Aplicar filtros</button>
    <button type="button" class="btn btn-secondary" (click)="clearFilters()">Limpar</button>
  </div>
</div>
@if(loading){<app-skeleton-table [columns]="7" [rows]="10" />}
@if(!loading){
<div class="card table-wrap">
  <p class="empty">Total de registros: <b>{{ rows.length }}</b></p>
  <table>
    <tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>ID</th><th>Antes</th><th>Depois</th></tr>
    @for(i of rows; track i.id){
      <tr>
        <td>{{i.created_at | dateBr:'datetime'}}</td>
        <td>{{i.user_name || (i.user_id ? '#' + i.user_id : '-')}}</td>
        <td>{{ actionLabel(i.action) }}</td>
        <td>{{ entityLabel(i.entity) }}</td>
        <td>{{i.entity_id ?? '-'}}</td>
        <td><small>{{i.before_data}}</small></td>
        <td><small>{{i.after_data}}</small></td>
      </tr>
    } @empty {
      <tr><td colspan="7" class="empty">Nenhum registro encontrado.</td></tr>
    }
  </table>
</div>
}`,
})
export class AuditComponent implements OnInit {
  rows: any[] = [];
  users: { id: number; name: string }[] = [];
  actionOptions = ACTION_OPTIONS;
  entityOptions = ENTITY_OPTIONS;
  loading = false;
  error = '';

  filters = {
    user_id: 0,
    action: '',
    entity: '',
    entity_id: 0,
    date_from: '',
    date_to: '',
  };

  private actionLabels = Object.fromEntries(ACTION_OPTIONS.filter((a) => a.value).map((a) => [a.value, a.label]));
  private entityLabels = Object.fromEntries(ENTITY_OPTIONS.filter((e) => e.value).map((e) => [e.value, e.label]));

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.get<{ id: number; name: string }[]>('/users').subscribe({
      next: (data) => (this.users = data),
    });
    this.load();
  }

  queryParams() {
    const p: Record<string, string | number> = {};
    if (this.filters.user_id) p['user_id'] = this.filters.user_id;
    if (this.filters.action) p['action'] = this.filters.action;
    if (this.filters.entity) p['entity'] = this.filters.entity;
    if (this.filters.entity_id) p['entity_id'] = this.filters.entity_id;
    if (this.filters.date_from) p['date_from'] = this.filters.date_from;
    if (this.filters.date_to) p['date_to'] = this.filters.date_to;
    return p;
  }

  applyFilters() {
    this.load();
  }

  clearFilters() {
    this.filters = {
      user_id: 0,
      action: '',
      entity: '',
      entity_id: 0,
      date_from: '',
      date_to: '',
    };
    this.load();
  }

  load() {
    this.loading = true;
    this.error = '';
    this.api.get<any[]>('/audit', this.queryParams()).subscribe({
      next: (data) => {
        this.rows = data;
        this.loading = false;
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar auditoria');
        this.loading = false;
      },
    });
  }

  actionLabel(value: string) {
    return this.actionLabels[value] || value;
  }

  entityLabel(value: string) {
    return this.entityLabels[value] || value;
  }
}
