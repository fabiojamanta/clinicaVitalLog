import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AttendanceSection } from './attendance.types';
import { workflowLabel } from './attendance-labels';

@Component({
  selector: 'app-attendance-subnav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DateBrPipe],
  template: `
@if(attendanceId){
  <div class="card attendance-subnav">
    <div class="attendance-subnav-head">
      <div>
        <h2>{{ patientName }}</h2>
        <p class="hint">Atendimento · {{ attendanceDate | dateBr }} · {{ workflowLabel(workflowStatus) }}</p>
      </div>
      <a routerLink="/atendimentos" class="btn btn-secondary btn-sm">Trocar paciente</a>
    </div>
    <nav class="attendance-tabs" aria-label="Seções do atendimento">
      <a
        [routerLink]="['/atendimentos/historico']"
        [queryParams]="{ patientId }"
        routerLinkActive="active"
        [routerLinkActiveOptions]="{ exact: false }"
        [class.active]="active === 'historico'"
      >Histórico</a>
      <a [routerLink]="['/atendimentos', attendanceId, 'sinais-vitais']" routerLinkActive="active" [class.active]="active === 'sinais-vitais'">Sinais vitais</a>
      <a [routerLink]="['/atendimentos', attendanceId, 'medico']" routerLinkActive="active" [class.active]="active === 'medico'">Médico</a>
      <a [routerLink]="['/atendimentos', attendanceId, 'tecnica']" routerLinkActive="active" [class.active]="active === 'tecnica'">Técnica</a>
      <a [routerLink]="['/atendimentos', attendanceId, 'dispensar']" routerLinkActive="active" [class.active]="active === 'dispensar'">Dispensar</a>
      <a [routerLink]="['/atendimentos', attendanceId, 'finalizar']" routerLinkActive="active" [class.active]="active === 'finalizar'">Finalizar</a>
    </nav>
  </div>
}`,
  styles: [`
    .attendance-subnav { margin-bottom: 12px; }
    .attendance-subnav-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .attendance-subnav-head h2 { margin: 0; font-size: 1.15rem; }
    .attendance-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .attendance-tabs a {
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      background: rgba(15, 118, 110, 0.08);
      font-weight: 600;
      font-size: 0.9rem;
    }
    .attendance-tabs a.active, .attendance-tabs a.router-link-active {
      background: var(--primary, #0f766e);
      color: #fff;
    }
  `],
})
export class AttendanceSubnavComponent {
  @Input({ required: true }) attendanceId!: number;
  @Input({ required: true }) patientId!: number;
  @Input({ required: true }) patientName!: string;
  @Input({ required: true }) attendanceDate!: string;
  @Input() workflowStatus = '';
  @Input() active: AttendanceSection = 'medico';

  readonly workflowLabel = workflowLabel;
}
