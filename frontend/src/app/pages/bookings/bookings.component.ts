import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';

type Payment = {
  id: number;
  payment_type: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  user_name?: string;
};

type Booking = {
  id: number;
  patient_id: number;
  patient_name: string;
  scheduled_date: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  status: string;
  attendance_id?: number;
  notes?: string;
  payments: Payment[];
};

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe],
  template: `
<div class="top"><div class="page-title"><h1>Reservas de consulta</h1><p>Registre reservas telefônicas com entrada de 30% e check-in com pagamento do saldo.</p></div></div>
@if(error){<div class="error">{{error}}</div>}

<div class="card grid grid-3">
  <div>
    <label>Paciente</label>
    <select [(ngModel)]="form.patient_id">
      <option [ngValue]="0">Selecione</option>
      @for(p of patients; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
  <div>
    <label>Data prevista</label>
    <input type="date" [(ngModel)]="form.scheduled_date">
  </div>
  <div>
    <label>Valor total (R$)</label>
    <input type="number" min="0" step="0.01" [(ngModel)]="form.total_amount" (ngModelChange)="recalc()">
  </div>
  <div>
    <label>Entrada 30%</label>
    <input type="text" [ngModel]="formatMoney(depositPreview)" readonly tabindex="-1">
  </div>
  <div>
    <label>Saldo 70%</label>
    <input type="text" [ngModel]="formatMoney(balancePreview)" readonly tabindex="-1">
  </div>
  <div>
    <label>Forma de pagamento (entrada)</label>
    <select [(ngModel)]="form.payment_method">
      <option value="pix">PIX</option>
      <option value="dinheiro">Dinheiro</option>
      <option value="cartao">Cartão</option>
      <option value="transferencia">Transferência</option>
    </select>
  </div>
  <div class="grid-span-full">
    <label>Observações</label>
    <input [(ngModel)]="form.notes" placeholder="Horário combinado, contato...">
  </div>
  <div class="form-actions grid-span-full">
    <button type="button" class="btn" (click)="createBooking()">Registrar reserva e entrada (30%)</button>
  </div>
</div>

<div class="card grid grid-3">
  <div>
    <label>Filtrar data</label>
    <input type="date" [(ngModel)]="filterDate" (ngModelChange)="load()">
  </div>
  <div>
    <label>Status</label>
    <select [(ngModel)]="filterStatus" (ngModelChange)="load()">
      <option value="">Todos</option>
      <option value="agendado">Agendado</option>
      <option value="presente">Presente (check-in)</option>
      <option value="cancelado">Cancelado</option>
    </select>
  </div>
  <div>
    <label>Paciente</label>
    <select [(ngModel)]="filterPatientId" (ngModelChange)="load()">
      <option [ngValue]="0">Todos</option>
      @for(p of patients; track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
</div>

<div class="card table-wrap">
  @if(rows.length){
  <table>
    <tr><th>Paciente</th><th>Data prevista</th><th>Total</th><th>Entrada</th><th>Saldo</th><th>Status</th><th>Pagamentos</th><th>Ações</th></tr>
    @for(b of rows; track b.id){
      <tr>
        <td>{{b.patient_name}}</td>
        <td>{{b.scheduled_date | dateBr}}</td>
        <td>{{formatMoney(b.total_amount)}}</td>
        <td>{{formatMoney(b.deposit_amount)}}</td>
        <td>{{formatMoney(b.balance_amount)}}</td>
        <td><span class="badge" [class.warn]="b.status==='agendado'">{{statusLabel(b.status)}}</span></td>
        <td>
          @for(p of b.payments; track p.id){
            <div class="hint">{{paymentTypeLabel(p.payment_type)}} · {{formatMoney(p.amount)}} · {{paymentMethodLabel(p.payment_method)}}</div>
          }
        </td>
        <td>
          @if(b.status==='agendado'){
            <button type="button" class="btn btn-sm" (click)="openCheckIn(b)">Check-in (70%)</button>
            <button type="button" class="btn btn-secondary btn-sm" (click)="cancelBooking(b)">Cancelar</button>
          }@else if(b.status==='presente' && b.attendance_id){
            <button type="button" class="btn btn-secondary btn-sm" (click)="openAttendance(b)">Abrir atendimento</button>
          }
        </td>
      </tr>
    }
  </table>
  }@else{<p class="hint">Nenhuma reserva encontrada.</p>}
</div>

@if(checkInBooking){
<div class="modal-backdrop" (click)="closeCheckIn()"></div>
<div class="modal card">
  <h3>Check-in — {{checkInBooking.patient_name}}</h3>
  <p>Saldo a receber: <strong>{{formatMoney(checkInBooking.balance_amount)}}</strong></p>
  <div class="grid grid-2">
    <div>
      <label>Forma de pagamento</label>
      <select [(ngModel)]="checkInForm.payment_method">
        <option value="pix">PIX</option>
        <option value="dinheiro">Dinheiro</option>
        <option value="cartao">Cartão</option>
        <option value="transferencia">Transferência</option>
      </select>
    </div>
    <div>
      <label>Observação do pagamento</label>
      <input [(ngModel)]="checkInForm.payment_notes">
    </div>
  </div>
  <div class="form-actions">
    <button type="button" class="btn" (click)="confirmCheckIn()">Confirmar check-in e abrir atendimento</button>
    <button type="button" class="btn btn-secondary" (click)="closeCheckIn()">Cancelar</button>
  </div>
</div>
}`,
  styles: [`
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; }
    .modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 101; min-width: 320px; max-width: 520px; }
  `],
})
export class BookingsComponent implements OnInit {
  patients: any[] = [];
  rows: Booking[] = [];
  error = '';

  form = {
    patient_id: 0,
    scheduled_date: todayIsoBr(),
    total_amount: 0,
    payment_method: 'pix',
    notes: '',
  };

  depositPreview = 0;
  balancePreview = 0;

  filterDate = todayIsoBr();
  filterStatus = '';
  filterPatientId = 0;

  checkInBooking: Booking | null = null;
  checkInForm = { payment_method: 'pix', payment_notes: '' };

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.api.get<any[]>('/clients').subscribe((r) => {
      this.patients = r.filter((c) => c.client_type === 'paciente' && c.active);
    });
    this.recalc();
    this.load();
  }

  recalc() {
    const total = Number(this.form.total_amount) || 0;
    this.depositPreview = Math.round(total * 0.3 * 100) / 100;
    this.balancePreview = Math.round((total - this.depositPreview) * 100) / 100;
  }

  formatMoney(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  load() {
    this.error = '';
    const params: Record<string, string | number | null> = {
      scheduled_date: this.filterDate,
    };
    if (this.filterStatus) params['status'] = this.filterStatus;
    if (this.filterPatientId) params['patient_id'] = this.filterPatientId;
    this.api.get<Booking[]>('/bookings', params).subscribe({
      next: (r) => (this.rows = r),
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar reservas'),
    });
  }

  createBooking() {
    this.error = '';
    if (!this.form.patient_id) {
      this.error = 'Selecione o paciente';
      return;
    }
    if (!this.form.total_amount || this.form.total_amount <= 0) {
      this.error = 'Informe o valor total';
      return;
    }
    this.api.post<Booking>('/bookings', {
      patient_id: this.form.patient_id,
      scheduled_date: this.form.scheduled_date,
      total_amount: this.form.total_amount,
      payment_method: this.form.payment_method,
      notes: this.form.notes || null,
    }).subscribe({
      next: () => {
        this.form = {
          patient_id: 0,
          scheduled_date: todayIsoBr(),
          total_amount: 0,
          payment_method: 'pix',
          notes: '',
        };
        this.recalc();
        this.load();
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao criar reserva'),
    });
  }

  openCheckIn(b: Booking) {
    this.checkInBooking = b;
    this.checkInForm = { payment_method: 'pix', payment_notes: '' };
  }

  closeCheckIn() {
    this.checkInBooking = null;
  }

  confirmCheckIn() {
    if (!this.checkInBooking) return;
    this.error = '';
    this.api.post<Booking>(`/bookings/${this.checkInBooking.id}/check-in`, this.checkInForm).subscribe({
      next: (b) => {
        this.closeCheckIn();
        this.load();
        if (b.attendance_id) {
          this.router.navigate(['/atendimentos'], { queryParams: { attendanceId: b.attendance_id } });
        }
      },
      error: (e) => (this.error = e.error?.detail || 'Erro no check-in'),
    });
  }

  cancelBooking(b: Booking) {
    if (!confirm(`Cancelar reserva de ${b.patient_name}?`)) return;
    this.api.post<Booking>(`/bookings/${b.id}/cancel`, {}).subscribe({
      next: () => this.load(),
      error: (e) => (this.error = e.error?.detail || 'Erro ao cancelar'),
    });
  }

  openAttendance(b: Booking) {
    if (b.attendance_id) {
      this.router.navigate(['/atendimentos'], { queryParams: { attendanceId: b.attendance_id } });
    }
  }

  statusLabel(s: string) {
    switch (s) {
      case 'agendado': return 'Agendado';
      case 'presente': return 'Presente';
      case 'cancelado': return 'Cancelado';
      default: return s;
    }
  }

  paymentTypeLabel(t: string) {
    return t === 'entrada' ? 'Entrada 30%' : 'Saldo 70%';
  }

  paymentMethodLabel(m: string) {
    switch (m) {
      case 'pix': return 'PIX';
      case 'dinheiro': return 'Dinheiro';
      case 'cartao': return 'Cartão';
      case 'transferencia': return 'Transferência';
      default: return m;
    }
  }
}
