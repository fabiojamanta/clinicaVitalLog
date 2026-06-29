import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { Attendance, Treatment } from './attendance.types';
import { AttendanceSubnavComponent } from './attendance-subnav.component';
import { bookingStatusLabel, formatMoney, paymentMethodLabel, sessionStatusLabel, summary } from './attendance-labels';

@Component({
  selector: 'app-attendance-doctor',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, ReadonlyBannerComponent, AttendanceSubnavComponent],
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
    active="medico"
  ></app-attendance-subnav>

  @if(current.booking){
  <div class="card section-card">
    <h3>Reserva e pagamentos</h3>
    <div class="grid grid-3">
      <div><label>Data prevista</label><input [value]="current.booking.scheduled_date" readonly tabindex="-1"></div>
      <div><label>Valor total</label><input [ngModel]="formatMoney(current.booking.total_amount)" readonly tabindex="-1"></div>
      <div><label>Status</label><input [ngModel]="bookingStatusLabel(current.booking.status)" readonly tabindex="-1"></div>
    </div>
    <table>
      <tr><th>Tipo</th><th>Valor</th><th>Forma</th><th>Data</th></tr>
      @for(p of current.booking.payments; track $index){
        <tr>
          <td>{{ p.payment_type === 'entrada' ? 'Entrada 30%' : 'Saldo 70%' }}</td>
          <td>{{ formatMoney(p.amount) }}</td>
          <td>{{ paymentMethodLabel(p.payment_method) }}</td>
          <td>{{ p.paid_at | dateBr:'datetime' }}</td>
        </tr>
      }
    </table>
  </div>
  }

  <div class="card section-card">
    <div class="section-head">
      <h3>Consulta médica e prescrição</h3>
      @if(current.doctor_updated_at){<span class="hint">{{ current.doctor_user_name }} · {{ current.doctor_updated_at | dateBr:'datetime' }}</span>}
    </div>
    @if(!current.vitals_recorded_at && auth.canEditDoctorSection()){
      <p class="hint warn">Aguardando registro dos sinais vitais pela enfermagem.</p>
    }
    <label>Anotações</label>
    <textarea rows="4" [(ngModel)]="doctorNotes" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Evolução, conduta..."></textarea>
    <label>Prescrição de medicamentos (clínica)</label>
    <textarea rows="4" [(ngModel)]="prescription" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Medicamentos prescritos, posologia..."></textarea>
    <label>Receita externa (exames/medicamentos de compra externa)</label>
    <textarea rows="4" [(ngModel)]="externalPrescription" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Exames e medicamentos para compra em farmácia externa..."></textarea>
    @if(auth.canEditDoctorSection()){
      <div class="form-actions">
        <button type="button" class="btn" [disabled]="!current.vitals_recorded_at" (click)="saveDoctor()">Salvar consulta médica</button>
        @if(externalPrescription.trim()){
          <button type="button" class="btn btn-secondary" (click)="printExternalPrescription()">Imprimir receita</button>
        }
      </div>
    }
  </div>

  @if(auth.canCreateTreatment()){
  <div class="card section-card">
    <h3>Criar tratamento com sessões</h3>
    <div class="grid grid-3">
      <div>
        <label>Número de sessões</label>
        <input type="number" min="1" max="100" [(ngModel)]="newTreatment.total_sessions">
      </div>
    </div>
    <label>Medicamentos do tratamento</label>
    <textarea rows="3" [(ngModel)]="newTreatment.medications" placeholder="Medicamentos a aplicar em cada sessão, posologia..."></textarea>
    <label>Observações</label>
    <textarea rows="2" [(ngModel)]="newTreatment.notes" placeholder="Frequência, cuidados..."></textarea>
    <div class="form-actions"><button type="button" class="btn" (click)="createTreatment()">Criar tratamento</button></div>
  </div>
  }

  @if(treatments.length){
  <div class="card table-wrap">
    <h3>Tratamentos do paciente</h3>
    <table>
      <tr><th>Medicamentos</th><th>Progresso</th><th>Médico</th><th>Sessões</th></tr>
      @for(t of treatments; track t.id){
        <tr>
          <td>{{ summary(t.medications) }}</td>
          <td><span class="badge" [class.warn]="t.sessions_done < t.total_sessions">{{ t.sessions_done }} de {{ t.total_sessions }}</span></td>
          <td>{{ t.doctor_user_name || '—' }}</td>
          <td>
            <div class="session-chips">
              @for(s of t.sessions; track s.id){
                <button type="button" class="btn btn-secondary btn-sm" (click)="openSession(s.id)">
                  {{ s.session_number }}ª · {{ sessionStatusLabel(s.status) }}
                </button>
              }
            </div>
          </td>
        </tr>
      }
    </table>
  </div>
  }
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
    .session-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  `],
})
export class AttendanceDoctorComponent implements OnInit {
  current: Attendance | null = null;
  error = '';
  doctorNotes = '';
  prescription = '';
  externalPrescription = '';
  treatments: Treatment[] = [];
  newTreatment = { medications: '', total_sessions: 1, notes: '' };

  readonly formatMoney = formatMoney;
  readonly bookingStatusLabel = bookingStatusLabel;
  readonly paymentMethodLabel = paymentMethodLabel;
  readonly sessionStatusLabel = sessionStatusLabel;
  readonly summary = summary;

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) this.loadAttendance(id);
    });
  }

  loadAttendance(id: number) {
    this.error = '';
    this.api.get<Attendance>(`/attendances/${id}`).subscribe({
      next: (a) => this.setCurrent(a),
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar atendimento');
        this.router.navigate(['/atendimentos']);
      },
    });
  }

  setCurrent(a: Attendance) {
    this.current = a;
    this.doctorNotes = a.doctor_notes || '';
    this.prescription = a.prescription || '';
    this.externalPrescription = a.external_prescription || '';
    this.loadTreatments();
  }

  saveDoctor() {
    if (!this.current) return;
    this.error = '';
    this.api
      .put<Attendance>(`/attendances/${this.current.id}/doctor`, {
        notes: this.doctorNotes,
        prescription: this.prescription,
        external_prescription: this.externalPrescription,
      })
      .subscribe({
        next: (a) => this.setCurrent(a),
        error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar consulta')),
      });
  }

  printExternalPrescription() {
    if (!this.current) return;
    this.api.openPdf(`/attendances/${this.current.id}/external-prescription.pdf`);
  }

  loadTreatments() {
    if (!this.current) return;
    this.api
      .get<Treatment[]>('/treatments', { patient_id: this.current.patient_id })
      .subscribe((r) => (this.treatments = r));
  }

  createTreatment() {
    if (!this.current) return;
    this.error = '';
    if (!this.newTreatment.medications.trim()) {
      this.error = 'Informe os medicamentos do tratamento';
      return;
    }
    if (!this.newTreatment.total_sessions || this.newTreatment.total_sessions < 1) {
      this.error = 'Informe o número de sessões';
      return;
    }
    this.api.post<Treatment>(`/attendances/${this.current.id}/treatments`, this.newTreatment).subscribe({
      next: () => {
        this.newTreatment = { medications: '', total_sessions: 1, notes: '' };
        this.loadTreatments();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao criar tratamento')),
    });
  }

  openSession(id: number) {
    this.router.navigate(['/sessoes', id]);
  }
}
