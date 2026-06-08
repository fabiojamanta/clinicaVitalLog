import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';

type PendingItem = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  pending_for: string;
  pending_action: string;
  workflow_status: string;
  prescription?: string;
  doctor_user_name?: string;
  doctor_updated_at?: string;
  has_dispensed: boolean;
};

@Component({
  selector: 'app-attendance-pending',
  standalone: true,
  imports: [CommonModule, DateBrPipe],
  template: `
<div class="top"><div class="page-title"><h1>Atendimentos Pendentes</h1><p>Atendimentos aguardando sua ação no fluxo.</p></div></div>
@if(error){<div class="error">{{error}}</div>}

<div class="card table-wrap">
  @if(rows.length){
  <table>
    <tr><th>Paciente</th><th>Data</th><th>Ação pendente</th><th>Médico</th><th>Prescrição</th><th>Status</th><th>Ações</th></tr>
    @for(i of rows;track trackRow(i)){
      <tr>
        <td>{{i.patient_name}}</td>
        <td>{{i.attendance_date | dateBr}}</td>
        <td><span class="badge warn">{{actionLabel(i.pending_action)}}</span></td>
        <td>{{i.doctor_user_name || '—'}}</td>
        <td>{{prescriptionSummary(i.prescription)}}</td>
        <td><span class="badge">{{statusLabel(i.workflow_status)}}</span></td>
        <td><button type="button" class="btn btn-secondary btn-sm" (click)="openAttendance(i.id)">Abrir atendimento</button></td>
      </tr>
    }
  </table>
  }@else{
    <p class="hint">Nenhum atendimento pendente para seu perfil.</p>
  }
</div>`,
})
export class AttendancePendingComponent implements OnInit {
  rows: PendingItem[] = [];
  error = '';

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.error = '';
    this.api.get<PendingItem[]>('/attendances/pending').subscribe({
      next: (r) => (this.rows = r),
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar pendências'),
    });
  }

  trackRow(i: PendingItem) {
    return `${i.id}-${i.pending_action}`;
  }

  actionLabel(action: string) {
    switch (action) {
      case 'tecnica':
        return 'Anotações da técnica';
      case 'dispensar':
        return 'Dispensar medicamento';
      case 'finalizar':
        return 'Finalizar enfermagem';
      default:
        return action;
    }
  }

  statusLabel(status: string) {
    switch (status) {
      case 'aguardando_tecnica':
        return 'Aguardando técnica';
      case 'aguardando_enfermagem':
        return 'Aguardando enfermagem';
      case 'aguardando_medico':
        return 'Aguardando médico';
      case 'concluido':
        return 'Concluído';
      default:
        return status;
    }
  }

  prescriptionSummary(text?: string) {
    const s = (text || '').trim();
    if (!s) return '—';
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  }

  openAttendance(id: number) {
    this.router.navigate(['/atendimentos'], { queryParams: { attendanceId: id } });
  }
}
