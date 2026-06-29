import { Component, OnDestroy, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SignaturePadComponent } from '../../shared/signature-pad.component';
import { TreatmentSession } from './treatment-session.types';
import { TreatmentSessionSubnavComponent } from './treatment-session-subnav.component';

@Component({
  selector: 'app-treatment-session-signature',
  standalone: true,
  imports: [CommonModule, DateBrPipe, ReadonlyBannerComponent, SignaturePadComponent, TreatmentSessionSubnavComponent],
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
    active="assinatura"
  ></app-treatment-session-subnav>

  <div class="card section-card">
    <div class="section-head">
      <h3>Confirmação do paciente</h3>
      @if(s.signed_at){<span class="hint">Assinado em {{s.signed_at | dateBr:'datetime'}}</span>}
    </div>
    @if(s.patient_signature){
      <img class="signature-img" [src]="s.patient_signature" alt="Assinatura do paciente">
    }@else if(s.status!=='concluido' && auth.canExecuteSession()){
      <p class="hint">O paciente precisa confirmar que a sessão foi realizada.</p>
      <div class="form-actions">
        <button type="button" class="btn" (click)="showSignModal=true">Assinar aqui</button>
        <button type="button" class="btn btn-secondary" (click)="createSignatureLink()">Enviar para o celular</button>
      </div>
    }@else{
      <p class="hint">Sessão ainda não assinada pelo paciente.</p>
    }
  </div>
}

@if(showSignModal){
<div class="modal-backdrop" (click)="showSignModal=false">
  <div class="modal-card card" (click)="$event.stopPropagation()">
    <h3>Assinatura do paciente</h3>
    <p class="hint">{{s?.patient_name}} confirma a realização da sessão {{s?.session_number}} de {{s?.total_sessions}}.</p>
    <app-signature-pad (signed)="submitSignature($event)"></app-signature-pad>
    <div class="form-actions"><button type="button" class="btn btn-secondary" (click)="showSignModal=false">Cancelar</button></div>
  </div>
</div>
}

@if(showLinkModal){
<div class="modal-backdrop" (click)="closeLinkModal()">
  <div class="modal-card card" (click)="$event.stopPropagation()">
    <h3>Assinatura pelo celular do paciente</h3>
    <p class="hint">Peça para o paciente apontar a câmera do celular para o QR code, ou envie o link. Válido por 1 hora e de uso único.</p>
    @if(qrDataUrl){<img class="qr-img" [src]="qrDataUrl" alt="QR code do link de assinatura">}
    <div class="form-actions link-actions">
      <button type="button" class="btn btn-secondary" (click)="copyLink()">{{copied ? 'Link copiado!' : 'Copiar link'}}</button>
      @if(whatsappUrl){<a class="btn btn-secondary" [href]="whatsappUrl" target="_blank" rel="noopener">Enviar por WhatsApp</a>}
    </div>
    <p class="hint">Aguardando assinatura do paciente…</p>
    <div class="form-actions"><button type="button" class="btn btn-secondary" (click)="closeLinkModal()">Fechar</button></div>
  </div>
</div>
}`,
  styles: [`
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
    .signature-img { max-width: 320px; border: 1px solid var(--border, #ccc); border-radius: 8px; background: #fff; display: block; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .modal-card { width: 100%; max-width: 460px; max-height: 90vh; overflow: auto; }
    .qr-img { width: 220px; height: 220px; display: block; margin: 8px auto; background: #fff; border-radius: 8px; }
    .link-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `],
})
export class TreatmentSessionSignatureComponent implements OnInit, OnDestroy {
  s: TreatmentSession | null = null;
  error = '';
  info = '';
  showSignModal = false;
  showLinkModal = false;
  qrDataUrl = '';
  signLink = '';
  whatsappUrl = '';
  copied = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

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

  ngOnDestroy() {
    this.stopPolling();
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

  submitSignature(signature: string) {
    if (!this.s) return;
    this.error = '';
    this.api.post<TreatmentSession>(`/treatment-sessions/${this.s.id}/signature`, { signature }).subscribe({
      next: (s) => {
        this.s = s;
        this.showSignModal = false;
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao registrar assinatura')),
    });
  }

  createSignatureLink() {
    if (!this.s) return;
    this.error = '';
    this.api.post<{ token: string }>(`/treatment-sessions/${this.s.id}/signature-link`, {}).subscribe({
      next: async (r) => {
        this.signLink = `${window.location.origin}/assinar/${r.token}`;
        this.whatsappUrl = this.buildWhatsappUrl();
        this.copied = false;
        try {
          this.qrDataUrl = await QRCode.toDataURL(this.signLink, { width: 440, margin: 1 });
        } catch {
          this.qrDataUrl = '';
        }
        this.showLinkModal = true;
        this.startPolling();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao gerar link de assinatura')),
    });
  }

  private buildWhatsappUrl(): string {
    const digits = (this.s?.patient_phone || '').replace(/\D/g, '');
    if (!digits) return '';
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    const msg = `Olá, ${this.s?.patient_name}! Confirme a realização da sua sessão de tratamento assinando neste link: ${this.signLink}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  copyLink() {
    navigator.clipboard?.writeText(this.signLink).then(() => (this.copied = true));
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (!this.s) return;
      this.api.get<TreatmentSession>(`/treatment-sessions/${this.s.id}`).subscribe((s) => {
        if (s.patient_signature) {
          this.s = s;
          this.closeLinkModal();
          this.info = 'Assinatura do paciente recebida.';
        }
      });
    }, 5000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  closeLinkModal() {
    this.showLinkModal = false;
    this.stopPolling();
  }
}
