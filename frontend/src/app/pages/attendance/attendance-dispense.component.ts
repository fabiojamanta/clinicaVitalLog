import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { Attendance } from './attendance.types';
import { AttendanceSubnavComponent } from './attendance-subnav.component';

@Component({
  selector: 'app-attendance-dispense',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateBrPipe,
    ReadonlyBannerComponent,
    SearchSelectComponent,
    AttendanceSubnavComponent,
  ],
  template: `
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

@if(current){
  <app-attendance-subnav
    [attendanceId]="current.id"
    [patientId]="current.patient_id"
    [patientName]="current.patient_name"
    [attendanceDate]="current.attendance_date"
    [workflowStatus]="current.workflow_status || ''"
    active="dispensar"
  ></app-attendance-subnav>

  @if(auth.canDispenseMedication()){
  <div class="card section-card">
    <h3>Dispensar medicamento</h3>
    <div class="grid grid-3">
      <div>
        <app-search-select
          fieldLabel="Produto"
          searchPath="/products"
          placeholder="Digite o nome do produto"
          [(ngModel)]="dispense.product_id"
          (ngModelChange)="onDispenseProductChange()"
        ></app-search-select>
      </div>
      <div><label>Lote</label><select [(ngModel)]="dispense.lot_id"><option [ngValue]="0">Selecione</option>@for(l of filteredLots; track l.id){<option [ngValue]="l.id">Lote {{ l.lot_number }} · val {{ l.expiration_date | dateBr }}</option>}</select></div>
      <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
      <div><label>Quantidade</label><input type="number" [(ngModel)]="dispense.quantity"></div>
      <div><label>Observação</label><input [(ngModel)]="dispense.notes"></div>
      <div class="form-actions"><button type="button" class="btn" (click)="dispenseMedication()">Dispensar</button></div>
    </div>
  </div>
  }@else{
    <div class="card"><p class="hint">Seu perfil não pode dispensar medicamentos neste atendimento.</p></div>
  }

  <div class="card table-wrap">
    <h3>Medicamentos aplicados/repassados neste atendimento</h3>
    @if(current.exits.length){
    <table>
      <tr><th>Produto</th><th>Lote</th><th>Qtd</th><th>Data</th></tr>
      @for(e of current.exits; track e.id){
        <tr><td>{{ e.product_name }}</td><td>{{ e.lot_number }}</td><td>{{ e.quantity }}</td><td>{{ e.exit_date | dateBr }}</td></tr>
      }
    </table>
    }@else{<p class="hint">Nenhum medicamento dispensado neste atendimento.</p>}
  </div>
}`,
})
export class AttendanceDispenseComponent implements OnInit {
  current: Attendance | null = null;
  error = '';
  lots: any[] = [];
  dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.loadAttendance(id);
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

  loadAttendance(id: number) {
    this.error = '';
    this.api.get<Attendance>(`/attendances/${id}`).subscribe({
      next: (a) => {
        this.current = a;
        this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar atendimento');
        this.router.navigate(['/atendimentos']);
      },
    });
  }

  onDispenseProductChange() {
    this.dispense.lot_id = 0;
  }

  dispenseMedication() {
    if (!this.current) return;
    this.error = '';
    if (!this.dispense.product_id || !this.dispense.lot_id) {
      this.error = 'Selecione produto e lote';
      return;
    }
    this.api.post(`/attendances/${this.current.id}/exits`, this.dispense).subscribe({
      next: () => {
        this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
        this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
        this.loadAttendance(this.current!.id);
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao dispensar medicamento')),
    });
  }
}
