import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { SignaturePadComponent } from '../../shared/signature-pad.component';

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
  imports: [CommonModule, DateBrPipe, SignaturePadComponent],
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
      <p>Obrigado, {{info?.patient_name}}! Sua confirmação da sessão {{info?.session_number}} de {{info?.total_sessions}} foi registrada com sucesso.</p>
      <p class="hint">Você já pode fechar esta página.</p>
    </div>
  }@else if(info){
    <div class="card">
      <h2>Confirmação de sessão</h2>
      <p><strong>Paciente:</strong> {{info.patient_name}}</p>
      <p><strong>Sessão:</strong> {{info.session_number}} de {{info.total_sessions}}</p>
      @if(info.session_date){<p><strong>Data:</strong> {{info.session_date | dateBr}}</p>}
      <p><strong>Tratamento prescrito:</strong></p>
      <p class="pre-wrap">{{info.medications}}</p>
      @if(info.exits.length){
        <p><strong>Medicamentos aplicados:</strong></p>
        <ul>
          @for(e of info.exits;track $index){
            <li>{{e.product_name}} — {{e.quantity}} {{e.unit || 'un'}}</li>
          }
        </ul>
      }
      @if(info.comments){
        <p><strong>Observações da equipe:</strong></p>
        <p class="pre-wrap">{{info.comments}}</p>
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
    }
    .pre-wrap { white-space: pre-wrap; }
  `],
})
export class PublicSignComponent implements OnInit {
  info: PublicSignInfo | null = null;
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
    this.token = this.route.snapshot.paramMap.get('token') || '';
    this.api.get<PublicSignInfo>(`/public/sign/${this.token}`).subscribe({
      next: (r) => {
        this.info = r;
        this.loading = false;
      },
      error: (e) => {
        this.fatalError = e.error?.detail || 'Link inválido, expirado ou já utilizado.';
        this.loading = false;
      },
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
        this.error = e.error?.detail || 'Erro ao registrar assinatura. Tente novamente.';
        this.submitting = false;
      },
    });
  }
}
