import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AttendanceNavSection } from '../../core/role-permissions';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { patientSearchParams } from '../../core/search-select.util';
import { AttendanceListItem } from './attendance.types';
import { AttendanceSubnavComponent } from './attendance-subnav.component';

@Component({
  selector: 'app-attendance-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DateBrPipe, SearchSelectComponent, AttendanceSubnavComponent],
  template: `
<div class="top"><div class="page-title"><h1>Histórico de atendimentos</h1><p>Consulte atendimentos anteriores e abra uma seção específica.</p></div></div>

<div class="card grid grid-3">
  <div>
    <app-search-select
      fieldLabel="Paciente"
      searchPath="/clients"
      [queryParams]="patientSearchParams"
      placeholder="Digite 3 letras e selecione na lista"
      [(ngModel)]="patientId"
      [initialLabel]="patientLabel"
      (ngModelChange)="onPatientChange()"
    ></app-search-select>
  </div>
  <div class="form-actions">
    <a routerLink="/atendimentos" class="btn btn-secondary">Voltar ao início</a>
  </div>
</div>

@if(activeAttendance){
  <app-attendance-subnav
    [attendanceId]="activeAttendance.id"
    [patientId]="patientId"
    [patientName]="activeAttendance.patient_name"
    [attendanceDate]="activeAttendance.attendance_date"
    [workflowStatus]="activeAttendance.workflow_status || ''"
    active="historico"
  ></app-attendance-subnav>
}

@if(patientId){
<div class="card table-wrap">
  @if(history.length){
  <table>
    <tr><th>Data</th><th>Registrado em</th><th>Status</th><th>Ações</th></tr>
    @for(h of history; track h.id){
      <tr>
        <td>{{ h.attendance_date | dateBr }}</td>
        <td>{{ h.created_at | dateBr:'datetime' }}</td>
        <td>
          <span class="badge" [class.warn]="h.workflow_status !== 'concluido'">{{ h.phase_label }}</span>
        </td>
        <td class="row-actions">
          @if(h.workflow_status !== 'concluido' && canSection(h.current_section)){
            <a class="btn btn-sm" [routerLink]="['/atendimentos', h.id, h.current_section]">Continuar</a>
          }@else if(h.workflow_status !== 'concluido'){
            <span class="btn btn-sm is-disabled" aria-disabled="true">Continuar</span>
          }
          @if(canSection('sinais-vitais')){
            <a class="btn btn-secondary btn-sm" [routerLink]="['/atendimentos', h.id, 'sinais-vitais']">Sinais</a>
          }@else{
            <span class="btn btn-secondary btn-sm is-disabled" aria-disabled="true">Sinais</span>
          }
          @if(canSection('medico')){
            <a class="btn btn-secondary btn-sm" [routerLink]="['/atendimentos', h.id, 'medico']">Médico</a>
          }@else{
            <span class="btn btn-secondary btn-sm is-disabled" aria-disabled="true">Médico</span>
          }
          @if(canSection('tecnica')){
            <a class="btn btn-secondary btn-sm" [routerLink]="['/atendimentos', h.id, 'tecnica']">Técnica</a>
          }@else{
            <span class="btn btn-secondary btn-sm is-disabled" aria-disabled="true">Técnica</span>
          }
          @if(canSection('dispensar')){
            <a class="btn btn-secondary btn-sm" [routerLink]="['/atendimentos', h.id, 'dispensar']">Dispensar</a>
          }@else{
            <span class="btn btn-secondary btn-sm is-disabled" aria-disabled="true">Dispensar</span>
          }
          @if(canSection('finalizar')){
            <a class="btn btn-secondary btn-sm" [routerLink]="['/atendimentos', h.id, 'finalizar']">Finalizar</a>
          }@else{
            <span class="btn btn-secondary btn-sm is-disabled" aria-disabled="true">Finalizar</span>
          }
        </td>
      </tr>
    }
  </table>
  }@else{
    <p class="hint">Nenhum atendimento registrado para este paciente.</p>
  }
</div>
}@else{
  <div class="card"><p class="hint">Selecione um paciente para ver o histórico.</p></div>
}`,
  styles: [`
    .row-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .row-actions .is-disabled {
      opacity: 0.55;
      cursor: not-allowed;
      pointer-events: none;
    }
  `],
})
export class AttendanceHistoryComponent implements OnInit {
  readonly patientSearchParams = patientSearchParams;
  patientId = 0;
  patientLabel = '';
  history: AttendanceListItem[] = [];
  activeAttendance: AttendanceListItem | null = null;

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  canSection(section: AttendanceNavSection) {
    return this.auth.canAccessAttendanceSection(section);
  }

  ngOnInit() {
    this.route.queryParamMap.subscribe((params) => {
      const pid = Number(params.get('patientId'));
      const aid = Number(params.get('attendanceId'));
      if (pid) {
        this.patientId = pid;
        this.loadHistory(aid || undefined);
      }
    });
  }

  onPatientChange() {
    this.router.navigate(['/atendimentos/historico'], {
      queryParams: this.patientId ? { patientId: this.patientId } : {},
    });
    if (this.patientId) this.loadHistory();
    else {
      this.history = [];
      this.activeAttendance = null;
    }
  }

  loadHistory(highlightId?: number) {
    if (!this.patientId) return;
    this.api.get<AttendanceListItem[]>('/attendances', { patient_id: this.patientId }).subscribe({
      next: (rows) => {
        this.history = [...rows].sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
        const pick = highlightId
          ? this.history.find((h) => h.id === highlightId)
          : this.history[0];
        this.activeAttendance = pick ?? null;
        if (pick) this.patientLabel = pick.patient_name;
      },
    });
  }
}
