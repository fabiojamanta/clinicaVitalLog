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
  selector: 'app-attendance-nursing-finalize',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, ReadonlyBannerComponent, AttendanceSubnavComponent],
  template: `
@if(error){<div class="error">{{error}}</div>}
@if(info){<div class="card"><p class="hint">{{info}}</p></div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

@if(current){
  <app-attendance-subnav
    [attendanceId]="current.id"
    [patientId]="current.patient_id"
    [patientName]="current.patient_name"
    [attendanceDate]="current.attendance_date"
    [workflowStatus]="current.workflow_status || ''"
    active="finalizar"
  ></app-attendance-subnav>

  <div class="card section-card">
    <div class="section-head">
      <h3>Finalização da enfermagem</h3>
      @if(current.nursing_updated_at){<span class="hint">{{ current.nursing_user_name }} · {{ current.nursing_updated_at | dateBr:'datetime' }}</span>}
    </div>
    <textarea rows="4" [(ngModel)]="nursingNotes" [readonly]="!auth.canEditNursingSection()" placeholder="Observações finais da enfermagem..."></textarea>
    @if(auth.canEditNursingSection()){
      <div class="form-actions"><button type="button" class="btn" (click)="saveNursing()">Finalizar enfermagem</button></div>
    }
  </div>
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
  `],
})
export class AttendanceNursingFinalizeComponent implements OnInit {
  current: Attendance | null = null;
  error = '';
  info = '';
  nursingNotes = '';

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
        this.nursingNotes = a.nursing_notes || '';
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar atendimento');
        this.router.navigate(['/atendimentos']);
      },
    });
  }

  saveNursing() {
    if (!this.current) return;
    this.error = '';
    this.api.put<Attendance>(`/attendances/${this.current.id}/nursing`, { notes: this.nursingNotes }).subscribe({
      next: (a) => {
        this.current = a;
        this.nursingNotes = a.nursing_notes || '';
        this.info = 'Atendimento finalizado pela enfermagem.';
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar enfermagem')),
    });
  }
}
