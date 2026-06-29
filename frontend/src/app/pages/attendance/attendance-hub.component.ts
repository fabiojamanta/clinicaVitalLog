import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { patientSearchParams } from '../../core/search-select.util';
import { Attendance, AttendanceListItem } from './attendance.types';

@Component({
  selector: 'app-attendance-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DateBrPipe, ReadonlyBannerComponent, SearchSelectComponent],
  template: `
<div class="top"><div class="page-title"><h1>Atendimento ao paciente</h1><p>Selecione o paciente e acesse cada etapa do fluxo em telas separadas.</p></div></div>
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

<div class="card grid grid-3">
  <div>
    <app-search-select
      fieldLabel="Paciente"
      searchPath="/clients"
      [queryParams]="patientSearchParams"
      placeholder="Digite 3 letras e selecione na lista"
      [(ngModel)]="selectedPatientId"
      [initialLabel]="selectedPatientLabel"
      (ngModelChange)="onPatientChange()"
    ></app-search-select>
  </div>
  <div>
    <label>Data do atendimento</label>
    <input type="date" [(ngModel)]="newDate">
  </div>
  @if(auth.canWriteMenu('atendimentos')){
  <div class="form-actions">
    <button type="button" class="btn" [disabled]="!selectedPatientId" (click)="openAttendance()">Abrir atendimento</button>
  </div>
  }
</div>

@if(selectedPatientId){
  <div class="card">
    <h3>Acesso rápido</h3>
    <div class="hub-actions">
      <a class="hub-card" [routerLink]="['/atendimentos/historico']" [queryParams]="{ patientId: selectedPatientId }">
        <strong>Histórico</strong>
        <span>Atendimentos anteriores do paciente</span>
      </a>
      @if(latestAttendanceId){
        <a class="hub-card" [routerLink]="['/atendimentos', latestAttendanceId, 'sinais-vitais']">
          <strong>Sinais vitais</strong>
          <span>Primeira etapa do atendimento</span>
        </a>
        <a class="hub-card" [routerLink]="['/atendimentos', latestAttendanceId, 'medico']">
          <strong>Consulta médica</strong>
          <span>Último atendimento · {{ latestAttendanceDate | dateBr }}</span>
        </a>
        <a class="hub-card" [routerLink]="['/atendimentos', latestAttendanceId, 'tecnica']">
          <strong>Técnica de enfermagem</strong>
          <span>Anotações da aplicação</span>
        </a>
        <a class="hub-card" [routerLink]="['/atendimentos', latestAttendanceId, 'dispensar']">
          <strong>Dispensar medicamento</strong>
          <span>Saída de estoque do atendimento</span>
        </a>
        <a class="hub-card" [routerLink]="['/atendimentos', latestAttendanceId, 'finalizar']">
          <strong>Finalizar enfermagem</strong>
          <span>Encerramento do atendimento</span>
        </a>
      }
    </div>
    @if(!latestAttendanceId){
      <p class="hint">Nenhum atendimento aberto para este paciente. Use "Abrir atendimento" acima.</p>
    }
  </div>
}`,
  styles: [`
    .hub-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 8px; }
    .hub-card {
      display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 10px;
      text-decoration: none; color: inherit; background: rgba(15, 118, 110, 0.06); border: 1px solid rgba(15, 118, 110, 0.15);
    }
    .hub-card:hover { background: rgba(15, 118, 110, 0.12); }
    .hub-card strong { font-size: 1rem; }
    .hub-card span { font-size: 0.85rem; color: #64748b; }
  `],
})
export class AttendanceHubComponent implements OnInit {
  readonly patientSearchParams = patientSearchParams;
  error = '';
  selectedPatientId = 0;
  selectedPatientLabel = '';
  newDate = todayIsoBr();
  latestAttendanceId = 0;
  latestAttendanceDate = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const attendanceId = Number(this.route.snapshot.queryParamMap.get('attendanceId'));
    const patientId = Number(this.route.snapshot.queryParamMap.get('patientId'));
    if (patientId) {
      this.selectedPatientId = patientId;
      this.loadHistory();
    }
    if (attendanceId) {
      this.api.get<Attendance>(`/attendances/${attendanceId}`).subscribe({
        next: (a) => {
          this.selectedPatientId = a.patient_id;
          this.selectedPatientLabel = a.patient_name;
          this.router.navigate(['/atendimentos', a.id, 'medico'], { replaceUrl: true });
        },
        error: () => this.router.navigate(['/atendimentos'], { replaceUrl: true }),
      });
    }
  }

  onPatientChange() {
    this.latestAttendanceId = 0;
    if (this.selectedPatientId) this.loadHistory();
  }

  loadHistory() {
    this.api.get<AttendanceListItem[]>('/attendances', { patient_id: this.selectedPatientId }).subscribe({
      next: (rows) => {
        const sorted = [...rows].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
        const latest = sorted[0];
        if (latest) {
          this.latestAttendanceId = latest.id;
          this.latestAttendanceDate = latest.attendance_date;
        }
      },
    });
  }

  openAttendance() {
    this.error = '';
    if (!this.selectedPatientId) return;
    this.api
      .post<Attendance>('/attendances', {
        patient_id: this.selectedPatientId,
        attendance_date: this.newDate,
      })
      .subscribe({
        next: (a) => {
          this.router.navigate(['/atendimentos', a.id, 'sinais-vitais']);
        },
        error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao abrir atendimento')),
      });
  }
}
