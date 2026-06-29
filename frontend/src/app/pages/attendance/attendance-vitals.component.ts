import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AuthService } from '../../services/auth.service';
import { VitalsChartComponent, VitalSignPoint } from '../../shared/vitals-chart.component';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { Attendance } from './attendance.types';
import { AttendanceSubnavComponent } from './attendance-subnav.component';

@Component({
  selector: 'app-attendance-vitals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateBrPipe,
    VitalsChartComponent,
    ReadonlyBannerComponent,
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
    active="sinais-vitais"
  ></app-attendance-subnav>

  <div class="card section-card">
    <div class="section-head">
      <h3>Sinais vitais</h3>
      @if(current.vitals_recorded_at){<span class="hint">{{ current.vitals_user_name }} · {{ current.vitals_recorded_at | dateBr:'datetime' }}</span>}
      @if(auth.canViewVitalsChart()){
        <button type="button" class="btn btn-secondary btn-sm" (click)="openVitalsChart()">Ver evolução dos sinais vitais</button>
      }
    </div>
    <div class="grid grid-3">
      <div><label>PA sistólica (mmHg)</label><input type="number" [(ngModel)]="vitals.systolic_bp" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>PA diastólica (mmHg)</label><input type="number" [(ngModel)]="vitals.diastolic_bp" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>FC (bpm)</label><input type="number" [(ngModel)]="vitals.heart_rate" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>Temperatura (°C)</label><input type="number" step="0.1" [(ngModel)]="vitals.temperature" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>Peso (kg)</label><input type="number" step="0.01" [(ngModel)]="vitals.weight" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>Altura (cm)</label><input type="number" step="0.1" [(ngModel)]="vitals.height" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>SpO₂ (%)</label><input type="number" [(ngModel)]="vitals.spo2" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>Glicemia (mg/dL)</label><input type="number" [(ngModel)]="vitals.glycemia" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
      <div><label>IMC</label><input [ngModel]="bmiPreview" readonly tabindex="-1"></div>
    </div>
    <label>Observações</label>
    <textarea rows="2" [(ngModel)]="vitals.notes" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></textarea>
    @if(auth.canEditVitals() && !current.doctor_updated_at){
      <div class="form-actions"><button type="button" class="btn" (click)="saveVitals()">Salvar sinais vitais</button></div>
    }
  </div>
}

@if(vitalsChartOpen){
<div class="modal-backdrop" (click)="closeVitalsChart()"></div>
<div class="modal card vitals-modal">
  <div class="section-head">
    <h3>Evolução dos sinais vitais — {{ current?.patient_name }}</h3>
    <button type="button" class="btn btn-secondary btn-sm" (click)="closeVitalsChart()">Fechar</button>
  </div>
  <app-vitals-chart [points]="vitalsHistory"></app-vitals-chart>
</div>
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; }
    .vitals-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 101; width: min(920px, 94vw); max-height: 90vh; overflow: auto; }
  `],
})
export class AttendanceVitalsComponent implements OnInit {
  current: Attendance | null = null;
  error = '';
  vitals = {
    systolic_bp: null as number | null,
    diastolic_bp: null as number | null,
    heart_rate: null as number | null,
    temperature: null as number | null,
    weight: null as number | null,
    height: null as number | null,
    spo2: null as number | null,
    glycemia: null as number | null,
    notes: '',
  };
  vitalsChartOpen = false;
  vitalsHistory: VitalSignPoint[] = [];

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

  get bmiPreview(): string {
    const w = this.vitals.weight;
    const h = this.vitals.height;
    if (w == null || h == null || h <= 0) return '—';
    return (w / ((h / 100) ** 2)).toFixed(1);
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
    const v = a.vitals;
    this.vitals = {
      systolic_bp: v?.systolic_bp ?? null,
      diastolic_bp: v?.diastolic_bp ?? null,
      heart_rate: v?.heart_rate ?? null,
      temperature: v?.temperature ?? null,
      weight: v?.weight ?? null,
      height: v?.height ?? null,
      spo2: v?.spo2 ?? null,
      glycemia: v?.glycemia ?? null,
      notes: v?.notes || '',
    };
  }

  saveVitals() {
    if (!this.current) return;
    this.error = '';
    this.api.put<Attendance>(`/attendances/${this.current.id}/vitals`, this.vitals).subscribe({
      next: (a) => this.setCurrent(a),
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar sinais vitais')),
    });
  }

  openVitalsChart() {
    if (!this.current) return;
    this.api.get<VitalSignPoint[]>(`/patients/${this.current.patient_id}/vital-signs`).subscribe({
      next: (r) => {
        this.vitalsHistory = r;
        this.vitalsChartOpen = true;
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao carregar histórico')),
    });
  }

  closeVitalsChart() {
    this.vitalsChartOpen = false;
  }
}
