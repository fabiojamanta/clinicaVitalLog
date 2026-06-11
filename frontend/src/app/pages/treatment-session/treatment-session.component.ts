import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import * as QRCode from 'qrcode';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { SignaturePadComponent } from '../../shared/signature-pad.component';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';

type SessionExit = {
  id: number;
  product_name: string;
  lot_number: string;
  quantity: number;
  exit_date: string;
};

type TreatmentSession = {
  id: number;
  treatment_id: number;
  session_number: number;
  total_sessions: number;
  patient_id: number;
  patient_name?: string;
  patient_phone?: string;
  medications: string;
  treatment_notes?: string;
  doctor_user_name?: string;
  session_date?: string;
  tech_notes?: string;
  tech_user_name?: string;
  tech_updated_at?: string;
  nursing_notes?: string;
  nursing_user_name?: string;
  nursing_updated_at?: string;
  patient_signature?: string;
  signed_at?: string;
  status: string;
  exits: SessionExit[];
};

@Component({
  selector: 'app-treatment-session',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, SignaturePadComponent, ReadonlyBannerComponent],
  template: `
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>
<div class="top">
  <div class="page-title">
    <h1>Sessão de tratamento</h1>
    <p>Registre a aplicação, dê saída nos medicamentos e colha a assinatura do paciente.</p>
  </div>
</div>
@if(error){<div class="error">{{error}}</div>}
@if(info){<div class="card"><p class="hint">{{info}}</p></div>}

@if(s){
<div class="card">
  <h2>{{s.patient_name}} · Sessão {{s.session_number}} de {{s.total_sessions}}</h2>
  <p>
    <span class="badge" [class.warn]="s.status!=='concluido'">{{statusLabel(s.status)}}</span>
    @if(s.signed_at){<span class="badge">Assinada pelo paciente</span>}
  </p>
  <label>Medicamentos prescritos pelo médico {{s.doctor_user_name ? '(' + s.doctor_user_name + ')' : ''}}</label>
  <textarea rows="3" [ngModel]="s.medications" readonly tabindex="-1"></textarea>
  @if(s.treatment_notes){
    <label>Observações do tratamento</label>
    <textarea rows="2" [ngModel]="s.treatment_notes" readonly tabindex="-1"></textarea>
  }
  <div class="form-actions">
    <button type="button" class="btn btn-secondary btn-sm" (click)="printReceipt()">Imprimir comprovante</button>
  </div>
</div>

@if(canDispense()){
<div class="card">
  <h3>Saída de medicamentos da sessão</h3>
  <div class="grid grid-3">
    <div><label>Produto</label><select [(ngModel)]="dispense.product_id" (ngModelChange)="dispense.lot_id=0"><option [ngValue]="0">Selecione</option>@for(p of products;track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
    <div><label>Lote</label><select [(ngModel)]="dispense.lot_id"><option [ngValue]="0">Selecione</option>@for(l of filteredLots;track l.id){<option [ngValue]="l.id">Lote {{l.lot_number}} · val {{l.expiration_date | dateBr}}</option>}</select></div>
    <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
    <div><label>Quantidade</label><input type="number" [(ngModel)]="dispense.quantity"></div>
    <div><label>Observação</label><input [(ngModel)]="dispense.notes"></div>
    <div class="form-actions"><button type="button" class="btn" (click)="dispenseMedication()">Dar saída</button></div>
  </div>
</div>
}

<div class="card table-wrap">
  <h3>Medicamentos aplicados nesta sessão</h3>
  @if(s.exits.length){
  <table>
    <tr><th>Produto</th><th>Lote</th><th>Qtd</th><th>Data</th></tr>
    @for(e of s.exits;track e.id){
      <tr><td>{{e.product_name}}</td><td>{{e.lot_number}}</td><td>{{e.quantity}}</td><td>{{e.exit_date | dateBr}}</td></tr>
    }
  </table>
  }@else{<p class="hint">Nenhuma saída registrada nesta sessão.</p>}
</div>

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

<div class="card section-card">
  <div class="section-head">
    <h3>Finalização (enfermagem)</h3>
    @if(s.nursing_updated_at){<span class="hint">{{s.nursing_user_name}} · {{s.nursing_updated_at | dateBr:'datetime'}}</span>}
  </div>
  <label>Comentário da enfermagem</label>
  <textarea rows="3" [(ngModel)]="nursingNotes" [readonly]="!canEditNursing()" placeholder="Revisão, observações finais..."></textarea>
  @if(canEditNursing()){
    <div class="form-actions">
      <button type="button" class="btn" [disabled]="!s.patient_signature" (click)="saveNursing()">Finalizar sessão</button>
      @if(!s.patient_signature){<span class="hint">Colha a assinatura do paciente para finalizar.</span>}
    </div>
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
    .signature-img { max-width: 320px; border: 1px solid var(--border, #ccc); border-radius: 8px; background: #fff; display: block; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
    .modal-card { width: 100%; max-width: 460px; max-height: 90vh; overflow: auto; }
    .qr-img { width: 220px; height: 220px; display: block; margin: 8px auto; background: #fff; border-radius: 8px; }
    .link-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  `],
})
export class TreatmentSessionComponent implements OnInit, OnDestroy {
  s: TreatmentSession | null = null;
  products: any[] = [];
  lots: any[] = [];
  error = '';
  info = '';

  sessionDate = todayIsoBr();
  techNotes = '';
  nursingNotes = '';
  dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };

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
  ) {}

  ngOnInit() {
    this.api.get<any[]>('/products').subscribe((r) => (this.products = r));
    this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
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
      next: (s) => this.setSession(s),
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar sessão'),
    });
  }

  private setSession(s: TreatmentSession) {
    this.s = s;
    this.sessionDate = s.session_date || todayIsoBr();
    this.techNotes = s.tech_notes || '';
    this.nursingNotes = s.nursing_notes || '';
  }

  get filteredLots() {
    if (!this.dispense.product_id) return [];
    return this.lots.filter((l) => l.product_id === this.dispense.product_id);
  }

  get selectedLotStock(): number | null {
    if (!this.dispense.lot_id) return null;
    const lot = this.lots.find((l) => l.id === this.dispense.lot_id);
    return lot ? lot.current_stock : null;
  }

  statusLabel(status: string) {
    switch (status) {
      case 'pendente':
        return 'Pendente de aplicação';
      case 'aguardando_enfermagem':
        return 'Aguardando enfermagem';
      case 'concluido':
        return 'Concluída';
      default:
        return status;
    }
  }

  canEditTech() {
    return !!this.s && this.s.status !== 'concluido' && this.auth.canEditTechSection();
  }

  canEditNursing() {
    return !!this.s && this.s.status !== 'concluido' && this.auth.canFinalizeSession();
  }

  canDispense() {
    return !!this.s && this.s.status !== 'concluido' && this.auth.canDispenseMedication();
  }

  dispenseMedication() {
    if (!this.s) return;
    this.error = '';
    if (!this.dispense.product_id || !this.dispense.lot_id) {
      this.error = 'Selecione produto e lote';
      return;
    }
    this.api.post(`/treatment-sessions/${this.s.id}/exits`, this.dispense).subscribe({
      next: () => {
        this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
        this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
        this.load(this.s!.id);
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao dar saída no medicamento'),
    });
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
        error: (e) => (this.error = e.error?.detail || 'Erro ao salvar sessão'),
      });
  }

  saveNursing() {
    if (!this.s) return;
    this.error = '';
    this.api
      .put<TreatmentSession>(`/treatment-sessions/${this.s.id}/nursing`, {
        session_date: this.sessionDate,
        notes: this.nursingNotes,
      })
      .subscribe({
        next: (s) => {
          this.setSession(s);
          this.info = 'Sessão finalizada.';
        },
        error: (e) => (this.error = e.error?.detail || 'Erro ao finalizar sessão'),
      });
  }

  submitSignature(signature: string) {
    if (!this.s) return;
    this.error = '';
    this.api.post<TreatmentSession>(`/treatment-sessions/${this.s.id}/signature`, { signature }).subscribe({
      next: (s) => {
        this.setSession(s);
        this.showSignModal = false;
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao registrar assinatura'),
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
      error: (e) => (this.error = e.error?.detail || 'Erro ao gerar link de assinatura'),
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
          this.setSession(s);
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

  printReceipt() {
    if (!this.s) return;
    this.api.openPdf(`/treatment-sessions/${this.s.id}/receipt.pdf`);
  }
}
