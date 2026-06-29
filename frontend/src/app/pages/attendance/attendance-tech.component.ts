import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { Attendance } from './attendance.types';
import { AttendanceSubnavComponent } from './attendance-subnav.component';

@Component({
  selector: 'app-attendance-tech',
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
    active="tecnica"
  ></app-attendance-subnav>

  <div class="card section-card">
    <div class="section-head">
      <h3>Anotações da Técnica de Enfermagem</h3>
      @if(current.tech_updated_at){<span class="hint">{{ current.tech_user_name }} · {{ current.tech_updated_at | dateBr:'datetime' }}</span>}
    </div>
    <textarea rows="6" [(ngModel)]="techNotes" [readonly]="!auth.canEditTechSection()" placeholder="Anotações da técnica de enfermagem..."></textarea>
    @if(auth.canEditTechSection()){
      <div class="form-actions"><button type="button" class="btn" (click)="saveTech()">Salvar seção da técnica</button></div>
    }
  </div>

  @if(current.exits.length){
  <div class="card table-wrap">
    <h3>Medicamentos aplicados neste atendimento</h3>
    <table>
      <tr><th>Produto</th><th>Lote</th><th>Qtd</th><th>Data</th></tr>
      @for(e of current.exits; track e.id){
        <tr><td>{{ e.product_name }}</td><td>{{ e.lot_number }}</td><td>{{ e.quantity }}</td><td>{{ e.exit_date | dateBr }}</td></tr>
      }
    </table>
  </div>
  }
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
  `],
})
export class AttendanceTechComponent implements OnInit {
  current: Attendance | null = null;
  error = '';
  techNotes = '';

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
      next: (a) => {
        this.current = a;
        this.techNotes = a.tech_notes || '';
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar atendimento');
        this.router.navigate(['/atendimentos']);
      },
    });
  }

  saveTech() {
    if (!this.current) return;
    this.error = '';
    this.api.put<Attendance>(`/attendances/${this.current.id}/tech`, { notes: this.techNotes }).subscribe({
      next: (a) => {
        this.current = a;
        this.techNotes = a.tech_notes || '';
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar anotações')),
    });
  }
}
