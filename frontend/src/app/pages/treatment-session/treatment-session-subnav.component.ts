import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { sessionStatusLabel } from './treatment-session-labels';
import { SessionSection } from './treatment-session.types';

@Component({
  selector: 'app-treatment-session-subnav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
@if(sessionId){
  <div class="card session-subnav">
    <div class="session-subnav-head">
      <div>
        <h2>{{ patientName }}</h2>
        <p class="hint">Sessão {{ sessionNumber }} de {{ totalSessions }} · {{ sessionStatusLabel(status) }}</p>
      </div>
      <a routerLink="/atendimentos-pendentes" class="btn btn-secondary btn-sm">Voltar às pendências</a>
    </div>
    <nav class="session-tabs" aria-label="Etapas da sessão">
      <a [routerLink]="['/sessoes', sessionId]" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" [class.active]="active === 'resumo'">Resumo</a>
      <a [routerLink]="['/sessoes', sessionId, 'medicamentos']" routerLinkActive="active" [class.active]="active === 'medicamentos'">Medicamentos</a>
      <a [routerLink]="['/sessoes', sessionId, 'aplicacao']" routerLinkActive="active" [class.active]="active === 'aplicacao'">Aplicação</a>
      <a [routerLink]="['/sessoes', sessionId, 'assinatura']" routerLinkActive="active" [class.active]="active === 'assinatura'">Assinatura</a>
      <a [routerLink]="['/sessoes', sessionId, 'enfermagem']" routerLinkActive="active" [class.active]="active === 'enfermagem'">Enfermagem</a>
    </nav>
  </div>
}`,
  styles: [`
    .session-subnav { margin-bottom: 12px; }
    .session-subnav-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .session-subnav-head h2 { margin: 0; font-size: 1.15rem; }
    .session-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
    .session-tabs a {
      padding: 8px 14px;
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      background: rgba(15, 118, 110, 0.08);
      font-weight: 600;
      font-size: 0.9rem;
    }
    .session-tabs a.active, .session-tabs a.router-link-active {
      background: var(--primary, #0f766e);
      color: #fff;
    }
  `],
})
export class TreatmentSessionSubnavComponent {
  @Input({ required: true }) sessionId!: number;
  @Input({ required: true }) patientName!: string;
  @Input({ required: true }) sessionNumber!: number;
  @Input({ required: true }) totalSessions!: number;
  @Input() status = '';
  @Input() active: SessionSection = 'resumo';

  readonly sessionStatusLabel = sessionStatusLabel;
}
