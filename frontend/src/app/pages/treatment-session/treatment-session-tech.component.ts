import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { TreatmentSession } from './treatment-session.types';
import { TreatmentSessionSubnavComponent } from './treatment-session-subnav.component';

@Component({
  selector: 'app-treatment-session-tech',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, ReadonlyBannerComponent, TreatmentSessionSubnavComponent],
  template: `
@if(error){<div class="error">{{error}}</div>}
@if(info){<div class="card"><p class="hint">{{info}}</p></div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

@if(s){
  <app-treatment-session-subnav
    [sessionId]="s.id"
    [patientName]="s.patient_name || 'Paciente'"
    [sessionNumber]="s.session_number"
    [totalSessions]="s.total_sessions"
    [status]="s.status"
    active="aplicacao"
  ></app-treatment-session-subnav>

  <div class="card section-card">
    <div class="section-head">
      <h3>Aplicação (técnica de enfermagem)</h3>
      @if(s.tech_updated_at){<span class="hint">{{s.tech_user_name}} · {{s.tech_updated_at | dateBr:'datetime'}}</span>}
    </div>
    <div class="grid grid-3">
      <div>
        <label>Data de realização</label>
        <input type="date" [(ngModel)]="sessionDate" [readonly]="!canEditTech()">
      </div>
    </div>
    <label>Comentário</label>
    <textarea rows="3" [(ngModel)]="techNotes" [readonly]="!canEditTech()" placeholder="O que foi feito, reações, observações..."></textarea>
    @if(canEditTech()){
      <div class="form-actions"><button type="button" class="btn" (click)="saveTech()">Salvar e enviar para a enfermeira</button></div>
    }
  </div>
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
  `],
})
export class TreatmentSessionTechComponent implements OnInit {
  s: TreatmentSession | null = null;
  error = '';
  info = '';
  sessionDate = todayIsoBr();
  techNotes = '';

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('id'));
      if (id) this.load(id);
    });
  }

  load(id: number) {
    this.error = '';
    this.api.get<TreatmentSession>(`/treatment-sessions/${id}`).subscribe({
      next: (s) => this.setSession(s),
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar sessão');
        this.router.navigate(['/atendimentos-pendentes']);
      },
    });
  }

  private setSession(s: TreatmentSession) {
    this.s = s;
    this.sessionDate = s.session_date || todayIsoBr();
    this.techNotes = s.tech_notes || '';
  }

  canEditTech() {
    return !!this.s && this.s.status !== 'concluido' && this.auth.canEditTechSection();
  }

  saveTech() {
    if (!this.s) return;
    this.error = '';
    this.api
      .put<TreatmentSession>(`/treatment-sessions/${this.s.id}/tech`, {
        session_date: this.sessionDate,
        notes: this.techNotes,
      })
      .subscribe({
        next: (s) => {
          this.setSession(s);
          this.info = 'Sessão registrada e enviada para a enfermeira.';
        },
        error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar sessão')),
      });
  }
}
