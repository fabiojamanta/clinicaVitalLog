import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';

type PendingItem = {
  id: number;
  item_type: 'atendimento' | 'sessao';
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
  session_id?: number;
  session_number?: number;
  total_sessions?: number;
};

@Component({
  selector: 'app-attendance-pending',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe],
  template: `
<div class="top"><div class="page-title"><h1>Pendências</h1><p>Atendimentos e sessões de tratamento aguardando ação no fluxo.</p></div></div>
@if(error){<div class="error">{{error}}</div>}

<div class="card grid grid-3">
  <div>
    <label>Filtrar por paciente</label>
    <select [(ngModel)]="patientId" (ngModelChange)="load()">
      <option [ngValue]="0">Todos os pacientes</option>
      @for(p of patients;track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
</div>

<div class="card table-wrap">
  @if(rows.length){
  <table>
    <tr><th>Tipo</th><th>Paciente</th><th>Data</th><th>Ação pendente</th><th>Pendente para</th><th>Médico</th><th>Prescrição</th><th>Status</th><th>Ações</th></tr>
    @for(i of rows;track trackRow(i)){
      <tr>
        <td>
          @if(i.item_type==='sessao'){
            <span class="badge">Sessão {{i.session_number}}/{{i.total_sessions}}</span>
          }@else{
            <span class="badge">Atendimento</span>
          }
        </td>
        <td>{{i.patient_name}}</td>
        <td>{{i.attendance_date | dateBr}}</td>
        <td><span class="badge warn">{{actionLabel(i.pending_action)}}</span></td>
        <td>{{pendingForLabel(i.pending_for)}}</td>
        <td>{{i.doctor_user_name || '—'}}</td>
        <td>{{prescriptionSummary(i.prescription)}}</td>
        <td><span class="badge">{{statusLabel(i.workflow_status)}}</span></td>
        <td><button type="button" class="btn btn-secondary btn-sm" (click)="open(i)">{{i.item_type==='sessao' ? 'Abrir sessão' : 'Abrir atendimento'}}</button></td>
      </tr>
    }
  </table>
  }@else{
    <p class="hint">Nenhuma pendência para seu perfil.</p>
  }
</div>`,
})
export class AttendancePendingComponent implements OnInit {
  rows: PendingItem[] = [];
  patients: any[] = [];
  patientId = 0;
  error = '';

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.api.get<any[]>('/clients').subscribe((r) => {
      this.patients = r.filter((c) => c.client_type === 'paciente' && c.active);
    });
    this.load();
  }

  load() {
    this.error = '';
    this.api
      .get<PendingItem[]>('/attendances/pending', { patient_id: this.patientId || null })
      .subscribe({
        next: (r) => (this.rows = r),
        error: (e) => (this.error = e.error?.detail || 'Erro ao carregar pendências'),
      });
  }

  trackRow(i: PendingItem) {
    return `${i.item_type}-${i.id}-${i.session_id || 0}-${i.pending_action}`;
  }

  actionLabel(action: string) {
    switch (action) {
      case 'tecnica':
        return 'Anotações da técnica';
      case 'dispensar':
        return 'Dispensar medicamento';
      case 'finalizar':
        return 'Finalizar enfermagem';
      case 'aplicar_sessao':
        return 'Aplicar sessão';
      case 'finalizar_sessao':
        return 'Finalizar sessão';
      default:
        return action;
    }
  }

  pendingForLabel(pendingFor: string) {
    switch (pendingFor) {
      case 'tecnica_enfermagem':
        return 'Técnica';
      case 'enfermeira':
        return 'Enfermeira';
      default:
        return pendingFor;
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
      case 'pendente':
        return 'Pendente de aplicação';
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

  open(i: PendingItem) {
    if (i.item_type === 'sessao' && i.session_id) {
      this.router.navigate(['/sessoes', i.session_id]);
    } else {
      this.router.navigate(['/atendimentos'], { queryParams: { attendanceId: i.id } });
    }
  }
}
