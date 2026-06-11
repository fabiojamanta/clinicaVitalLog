import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { SignaturePadComponent } from '../../shared/signature-pad.component';

type PublicSignPreview = {
  clinic_name: string;
  session_number: number;
  total_sessions: number;
  session_date?: string;
  ready_to_sign: boolean;
};

type PublicSignInfo = {
  patient_name: string;
  session_number: number;
  total_sessions: number;
  session_date?: string;
  medications: string;
  comments?: string;
  exits: { product_name: string; quantity: number; unit?: string }[];
};

@Component({
  selector: 'app-public-sign',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, SignaturePadComponent],
  template: `
<div class="public-sign-page">
  @if(loading){
    <div class="card"><p class="hint">Carregando…</p></div>
  }@else if(fatalError){
    <div class="card">
      <h2>Não foi possível abrir</h2>
      <p>{{fatalError}}</p>
    </div>
  }@else if(done){
    <div class="card">
      <h2>Assinatura registrada</h2>
      <p>Obrigado! Sua confirmação da sessão {{preview?.session_number}} de {{preview?.total_sessions}} foi registrada com sucesso.</p>
      <p class="hint">Você já pode fechar esta página.</p>
    </div>
  }@else if(preview){
    <div class="card">
      <h2>Confirmação de sessão</h2>
      <p><strong>{{preview.clinic_name}}</strong></p>
      <p><strong>Sessão:</strong> {{preview.session_number}} de {{preview.total_sessions}}</p>
      @if(preview.session_date){<p><strong>Data:</strong> {{preview.session_date | dateBr}}</p>}
      @if(!details){
        <p class="hint">Toque em "Ver detalhes" para conferir o que está sendo confirmado.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" (click)="loadDetails()">Ver detalhes da sessão</button>
        </div>
      }@else {
        <p><strong>Paciente:</strong> {{details.patient_name}}</p>
        <p><strong>Tratamento prescrito:</strong></p>
        <p class="pre-wrap">{{details.medications}}</p>
        @if(details.exits.length){
          <p><strong>Medicamentos aplicados:</strong></p>
          <ul>
            @for(e of details.exits;track $index){
              <li>{{e.product_name}} — {{e.quantity}} {{e.unit || 'un'}}</li>
            }
          </ul>
        }
        @if(details.comments){
          <p><strong>Observações da equipe:</strong></p>
          <p class="pre-wrap">{{details.comments}}</p>
        }
      }
    </div>
    <div class="card">
      <h3>Assine abaixo para confirmar que a sessão foi realizada</h3>
      @if(error){<div class="error">{{error}}</div>}
      <app-signature-pad (signed)="submit($event)"></app-signature-pad>
      @if(submitting){<p class="hint">Enviando assinatura…</p>}
    </div>
  }
</div>`,
  styles: [`
    .public-sign-page {
      max-width: 560px;
      margin: 0 auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 100vh;
      color: #0f172a;
      font-family: "Plus Jakarta Sans", system-ui, sans-serif;
    }
    .public-sign-page .card {
      background: rgba(255, 255, 255, 0.9);
      border-radius: 12px;
      padding: 16px;
    }
    .public-sign-page h2, .public-sign-page h3 { margin: 0 0 8px; }
    .public-sign-page .hint { color: #64748b; }
    .public-sign-page .error { color: #b42318; background: #fdecea; padding: 10px; border-radius: 8px; }
    .pre-wrap { white-space: pre-wrap; }
  `],
})
export class PublicSignComponent implements OnInit {
  preview: PublicSignPreview | null = null;
  details: PublicSignInfo | null = null;
  loading = true;
  fatalError = '';
  error = '';
  done = false;
  submitting = false;
  private token = '';

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      this.token = params.get('token') || '';
      if (!this.token) {
        this.fatalError = 'Link inválido.';
        this.loading = false;
        return;
      }
      this.loadPreview();
    });
  }

  private loadPreview() {
    this.loading = true;
    this.fatalError = '';
    this.api.get<PublicSignPreview>(`/public/sign/${this.token}`).subscribe({
      next: (r) => {
        this.preview = r;
        this.loading = false;
      },
      error: (e) => {
        this.fatalError = formatApiError(e.error?.detail, 'Link inválido, expirado ou já utilizado.');
        this.loading = false;
      },
    });
  }

  loadDetails() {
    this.api.get<PublicSignInfo>(`/public/sign/${this.token}/details`).subscribe({
      next: (r) => { this.details = r; },
      error: (e) => { this.error = formatApiError(e.error?.detail, 'Não foi possível carregar os detalhes.'); },
    });
  }

  submit(signature: string) {
    if (this.submitting) return;
    this.submitting = true;
    this.error = '';
    this.api.post<PublicSignInfo>(`/public/sign/${this.token}`, { signature }).subscribe({
      next: () => {
        this.done = true;
        this.submitting = false;
      },
      error: (e) => {
        this.error = formatApiError(e.error?.detail, 'Erro ao registrar assinatura. Tente novamente.');
        this.submitting = false;
      },
    });
  }
}
