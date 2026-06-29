import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { TreatmentSession } from './treatment-session.types';
import { TreatmentSessionSubnavComponent } from './treatment-session-subnav.component';

@Component({
  selector: 'app-treatment-session-medications',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, ReadonlyBannerComponent, SearchSelectComponent, TreatmentSessionSubnavComponent],
  template: `
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

@if(s){
  <app-treatment-session-subnav
    [sessionId]="s.id"
    [patientName]="s.patient_name || 'Paciente'"
    [sessionNumber]="s.session_number"
    [totalSessions]="s.total_sessions"
    [status]="s.status"
    active="medicamentos"
  ></app-treatment-session-subnav>

  @if(canDispense()){
  <div class="card">
    <h3>Saída de medicamentos da sessão</h3>
    <div class="grid grid-3">
      <div>
        <app-search-select
          fieldLabel="Produto"
          searchPath="/products"
          placeholder="Digite o nome do produto"
          [(ngModel)]="dispense.product_id"
          (ngModelChange)="dispense.lot_id = 0"
        ></app-search-select>
      </div>
      <div><label>Lote</label><select [(ngModel)]="dispense.lot_id"><option [ngValue]="0">Selecione</option>@for(l of filteredLots;track l.id){<option [ngValue]="l.id">Lote {{l.lot_number}} · val {{l.expiration_date | dateBr}}</option>}</select></div>
      <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
      <div><label>Quantidade</label><input type="number" [(ngModel)]="dispense.quantity"></div>
      <div><label>Observação</label><input [(ngModel)]="dispense.notes"></div>
      <div class="form-actions"><button type="button" class="btn" (click)="dispenseMedication()">Dar saída</button></div>
    </div>
  </div>
  }

  <div class="card table-wrap">
    <h3>Medicamentos aplicados nesta sessão</h3>
    @if(s.exits.length){
    <table>
      <tr><th>Produto</th><th>Lote</th><th>Qtd</th><th>Data</th></tr>
      @for(e of s.exits;track e.id){
        <tr><td>{{e.product_name}}</td><td>{{e.lot_number}}</td><td>{{e.quantity}}</td><td>{{e.exit_date | dateBr}}</td></tr>
      }
    </table>
    }@else{<p class="hint">Nenhuma saída registrada nesta sessão.</p>}
  </div>
}`,
})
export class TreatmentSessionMedicationsComponent implements OnInit {
  s: TreatmentSession | null = null;
  lots: any[] = [];
  error = '';
  dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('id'));
      if (id) this.load(id);
    });
  }

  load(id: number) {
    this.error = '';
    this.api.get<TreatmentSession>(`/treatment-sessions/${id}`).subscribe({
      next: (s) => (this.s = s),
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar sessão');
        this.router.navigate(['/atendimentos-pendentes']);
      },
    });
  }

  get filteredLots() {
    if (!this.dispense.product_id) return [];
    return this.lots.filter((l) => l.product_id === this.dispense.product_id);
  }

  get selectedLotStock(): number | null {
    if (!this.dispense.lot_id) return null;
    const lot = this.lots.find((l) => l.id === this.dispense.lot_id);
    return lot ? lot.current_stock : null;
  }

  canDispense() {
    return !!this.s && this.s.status !== 'concluido' && this.auth.canDispenseMedication();
  }

  dispenseMedication() {
    if (!this.s) return;
    this.error = '';
    if (!this.dispense.product_id || !this.dispense.lot_id) {
      this.error = 'Selecione produto e lote';
      return;
    }
    this.api.post(`/treatment-sessions/${this.s.id}/exits`, this.dispense).subscribe({
      next: () => {
        this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
        this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
        this.load(this.s!.id);
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao dar saída no medicamento')),
    });
  }
}
