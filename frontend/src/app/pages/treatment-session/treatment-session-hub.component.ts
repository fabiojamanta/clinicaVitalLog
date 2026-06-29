import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { sessionStatusLabel } from './treatment-session-labels';
import { TreatmentSession } from './treatment-session.types';
import { TreatmentSessionSubnavComponent } from './treatment-session-subnav.component';

@Component({
  selector: 'app-treatment-session-hub',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReadonlyBannerComponent, TreatmentSessionSubnavComponent],
  template: `
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

@if(s){
  <app-treatment-session-subnav
    [sessionId]="s.id"
    [patientName]="s.patient_name || 'Paciente'"
    [sessionNumber]="s.session_number"
    [totalSessions]="s.total_sessions"
    [status]="s.status"
    active="resumo"
  ></app-treatment-session-subnav>

  <div class="card">
    <h2>{{ s.patient_name }} · Sessão {{ s.session_number }} de {{ s.total_sessions }}</h2>
    <p>
      <span class="badge" [class.warn]="s.status!=='concluido'">{{ sessionStatusLabel(s.status) }}</span>
      @if(s.signed_at){<span class="badge">Assinada pelo paciente</span>}
    </p>
    <label>Medicamentos prescritos pelo médico {{ s.doctor_user_name ? '(' + s.doctor_user_name + ')' : '' }}</label>
    <textarea rows="3" [ngModel]="s.medications" readonly tabindex="-1"></textarea>
    @if(s.treatment_notes){
      <label>Observações do tratamento</label>
      <textarea rows="2" [ngModel]="s.treatment_notes" readonly tabindex="-1"></textarea>
    }
    <div class="form-actions">
      <button type="button" class="btn btn-secondary btn-sm" (click)="printReceipt()">Imprimir comprovante</button>
    </div>
  </div>

  <div class="card">
    <h3>Etapas da sessão</h3>
    <div class="hub-actions">
      @if(auth.canAccessSessionSection('medicamentos')){
        <a class="hub-card" [routerLink]="['/sessoes', s.id, 'medicamentos']">
          <strong>Medicamentos</strong>
          <span>Saída de estoque e itens aplicados</span>
        </a>
      }@else{
        <div class="hub-card is-disabled" aria-disabled="true">
          <strong>Medicamentos</strong>
          <span>Saída de estoque e itens aplicados</span>
        </div>
      }
      @if(auth.canAccessSessionSection('aplicacao')){
        <a class="hub-card" [routerLink]="['/sessoes', s.id, 'aplicacao']">
          <strong>Aplicação</strong>
          <span>Registro da técnica de enfermagem</span>
        </a>
      }@else{
        <div class="hub-card is-disabled" aria-disabled="true">
          <strong>Aplicação</strong>
          <span>Registro da técnica de enfermagem</span>
        </div>
      }
      @if(auth.canAccessSessionSection('assinatura')){
        <a class="hub-card" [routerLink]="['/sessoes', s.id, 'assinatura']">
          <strong>Assinatura</strong>
          <span>Confirmação do paciente</span>
        </a>
      }@else{
        <div class="hub-card is-disabled" aria-disabled="true">
          <strong>Assinatura</strong>
          <span>Confirmação do paciente</span>
        </div>
      }
      @if(auth.canAccessSessionSection('enfermagem')){
        <a class="hub-card" [routerLink]="['/sessoes', s.id, 'enfermagem']">
          <strong>Enfermagem</strong>
          <span>Revisão e finalização</span>
        </a>
      }@else{
        <div class="hub-card is-disabled" aria-disabled="true">
          <strong>Enfermagem</strong>
          <span>Revisão e finalização</span>
        </div>
      }
    </div>
  </div>
}`,
  styles: [`
    .hub-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 8px; }
    .hub-card {
      display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 10px;
      text-decoration: none; color: inherit; background: rgba(15, 118, 110, 0.06); border: 1px solid rgba(15, 118, 110, 0.15);
    }
    .hub-card:hover { background: rgba(15, 118, 110, 0.12); }
    .hub-card.is-disabled {
      opacity: 0.55;
      cursor: not-allowed;
      pointer-events: none;
    }
    .hub-card strong { font-size: 1rem; }
    .hub-card span { font-size: 0.85rem; color: #64748b; }
  `],
})
export class TreatmentSessionHubComponent implements OnInit {
  s: TreatmentSession | null = null;
  error = '';
  readonly sessionStatusLabel = sessionStatusLabel;

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
      next: (s) => (this.s = s),
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao carregar sessão');
        this.router.navigate(['/atendimentos-pendentes']);
      },
    });
  }

  printReceipt() {
    if (!this.s) return;
    this.api.openPdf(`/treatment-sessions/${this.s.id}/receipt.pdf`);
  }
}
