import { Component, OnInit } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';
import { VitalsChartComponent, VitalSignPoint } from '../../shared/vitals-chart.component';
import { ReadonlyBannerComponent } from '../../shared/readonly-banner.component';
import { SearchSelectComponent } from '../../shared/search-select.component';
import { patientSearchParams } from '../../core/search-select.util';

type TreatmentSessionItem = {
  id: number;
  session_number: number;
  session_date?: string;
  status: string;
  signed: boolean;
};

type Treatment = {
  id: number;
  attendance_id: number;
  patient_id: number;
  medications: string;
  total_sessions: number;
  notes?: string;
  doctor_user_name?: string;
  created_at?: string;
  sessions_done: number;
  sessions: TreatmentSessionItem[];
};

type AttendanceListItem = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  created_at?: string;
};

type AttendanceExit = {
  id: number;
  product_id: number;
  lot_id: number;
  quantity: number;
  exit_date: string;
  product_name: string;
  lot_number: string;
};

type VitalSign = {
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: number | null;
  spo2?: number | null;
  glycemia?: number | null;
  notes?: string | null;
  recorded_by_name?: string;
  recorded_at?: string;
  bmi?: number | null;
};

type BookingPayment = {
  payment_type: string;
  amount: number;
  payment_method: string;
  paid_at: string;
};

type BookingSummary = {
  id: number;
  scheduled_date: string;
  total_amount: number;
  deposit_amount: number;
  balance_amount: number;
  status: string;
  payments: BookingPayment[];
};

type Attendance = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  doctor_notes?: string;
  prescription?: string;
  external_prescription?: string;
  tech_notes?: string;
  nursing_notes?: string;
  doctor_user_name?: string;
  tech_user_name?: string;
  nursing_user_name?: string;
  vitals_user_name?: string;
  doctor_updated_at?: string;
  tech_updated_at?: string;
  nursing_updated_at?: string;
  vitals_recorded_at?: string;
  workflow_status?: string;
  booking?: BookingSummary | null;
  vitals?: VitalSign | null;
  exits: AttendanceExit[];
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe, VitalsChartComponent, ReadonlyBannerComponent, SearchSelectComponent],
  template: `
<div class="top"><div class="page-title"><h1>Atendimento ao paciente</h1><p>Fluxo: sinais vitais → consulta médica → sessões de tratamento.</p></div></div>
@if(error){<div class="error">{{error}}</div>}
<app-readonly-banner [show]="auth.isReadOnlyMenu('atendimentos')"></app-readonly-banner>

<div class="card grid grid-3">
  <div>
    <app-search-select
      fieldLabel="Paciente"
      searchPath="/clients"
      [queryParams]="patientSearchParams"
      placeholder="Digite 3 letras e selecione na lista"
      [(ngModel)]="selectedPatientId"
      [initialLabel]="selectedPatientLabel"
      (ngModelChange)="onPatientChange()"
    ></app-search-select>
  </div>
  <div>
    <label>Data do atendimento</label>
    <input type="date" [(ngModel)]="newDate">
  </div>
  @if(auth.canWriteMenu('atendimentos')){
  <div class="form-actions">
    <button type="button" class="btn" [disabled]="!selectedPatientId" (click)="openAttendance()">Abrir atendimento</button>
  </div>
  }
</div>

@if(selectedPatientId){
<div class="card table-wrap">
  <h3>Histórico de atendimentos</h3>
  @if(history.length){
  <table>
    <tr><th>Data</th><th>Registrado em</th><th>Status</th><th>Ações</th></tr>
    @for(h of history;track h.id){
      <tr [class.row-active]="current?.id===h.id">
        <td>{{h.attendance_date | dateBr}}</td>
        <td>{{h.created_at | dateBr:'datetime'}}</td>
        <td>—</td>
        <td><button type="button" class="btn btn-secondary btn-sm" (click)="loadAttendance(h.id)">Abrir</button></td>
      </tr>
    }
  </table>
  }@else{<p class="hint">Nenhum atendimento registrado para este paciente.</p>}
</div>
}

@if(current){
<div class="card">
  <h2>Atendimento de {{current.patient_name}} · {{current.attendance_date | dateBr}}</h2>
  @if(current.workflow_status){<p class="hint">Status: {{workflowLabel(current.workflow_status)}}</p>}
</div>

@if(current.booking){
<div class="card section-card">
  <h3>Reserva e pagamentos</h3>
  <div class="grid grid-3">
    <div><label>Data prevista</label><input [value]="current.booking.scheduled_date" readonly tabindex="-1"></div>
    <div><label>Valor total</label><input [ngModel]="formatMoney(current.booking.total_amount)" readonly tabindex="-1"></div>
    <div><label>Status</label><input [ngModel]="bookingStatusLabel(current.booking.status)" readonly tabindex="-1"></div>
  </div>
  <table>
    <tr><th>Tipo</th><th>Valor</th><th>Forma</th><th>Data</th></tr>
    @for(p of current.booking.payments; track $index){
      <tr>
        <td>{{p.payment_type === 'entrada' ? 'Entrada 30%' : 'Saldo 70%'}}</td>
        <td>{{formatMoney(p.amount)}}</td>
        <td>{{paymentMethodLabel(p.payment_method)}}</td>
        <td>{{p.paid_at | dateBr:'datetime'}}</td>
      </tr>
    }
  </table>
</div>
}

<div class="card section-card">
  <div class="section-head">
    <h3>Sinais vitais</h3>
    @if(current.vitals_recorded_at){<span class="hint">{{current.vitals_user_name}} · {{current.vitals_recorded_at | dateBr:'datetime'}}</span>}
    @if(auth.canViewVitalsChart()){
      <button type="button" class="btn btn-secondary btn-sm" (click)="openVitalsChart()">Ver evolução dos sinais vitais</button>
    }
  </div>
  <div class="grid grid-3">
    <div><label>PA sistólica (mmHg)</label><input type="number" [(ngModel)]="vitals.systolic_bp" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>PA diastólica (mmHg)</label><input type="number" [(ngModel)]="vitals.diastolic_bp" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>FC (bpm)</label><input type="number" [(ngModel)]="vitals.heart_rate" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>Temperatura (°C)</label><input type="number" step="0.1" [(ngModel)]="vitals.temperature" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>Peso (kg)</label><input type="number" step="0.01" [(ngModel)]="vitals.weight" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>Altura (cm)</label><input type="number" step="0.1" [(ngModel)]="vitals.height" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>SpO₂ (%)</label><input type="number" [(ngModel)]="vitals.spo2" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>Glicemia (mg/dL)</label><input type="number" [(ngModel)]="vitals.glycemia" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></div>
    <div><label>IMC</label><input [ngModel]="bmiPreview" readonly tabindex="-1"></div>
  </div>
  <label>Observações</label>
  <textarea rows="2" [(ngModel)]="vitals.notes" [readonly]="!auth.canEditVitals() || !!current.doctor_updated_at"></textarea>
  @if(auth.canEditVitals() && !current.doctor_updated_at){
    <div class="form-actions"><button type="button" class="btn" (click)="saveVitals()">Salvar sinais vitais</button></div>
  }
</div>

<div class="card section-card">
  <div class="section-head">
    <h3>Consulta médica e prescrição</h3>
    @if(current.doctor_updated_at){<span class="hint">{{current.doctor_user_name}} · {{current.doctor_updated_at | dateBr:'datetime'}}</span>}
  </div>
  @if(!current.vitals_recorded_at && auth.canEditDoctorSection()){
    <p class="hint warn">Aguardando registro dos sinais vitais pela enfermagem.</p>
  }
  <label>Anotações</label>
  <textarea rows="4" [(ngModel)]="doctorNotes" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Evolução, conduta..."></textarea>
  <label>Prescrição de medicamentos (clínica)</label>
  <textarea rows="4" [(ngModel)]="prescription" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Medicamentos prescritos, posologia..."></textarea>
  <label>Receita externa (exames/medicamentos de compra externa)</label>
  <textarea rows="4" [(ngModel)]="externalPrescription" [readonly]="!auth.canEditDoctorSection() || !current.vitals_recorded_at" placeholder="Exames e medicamentos para compra em farmácia externa..."></textarea>
  @if(auth.canEditDoctorSection()){
    <div class="form-actions">
      <button type="button" class="btn" [disabled]="!current.vitals_recorded_at" (click)="saveSection('doctor')">Salvar consulta médica</button>
      @if(externalPrescription.trim()){
        <button type="button" class="btn btn-secondary" (click)="printExternalPrescription()">Imprimir receita</button>
      }
    </div>
  }
</div>

@if(auth.canCreateTreatment()){
<div class="card section-card">
  <h3>Criar tratamento com sessões</h3>
  <div class="grid grid-3">
    <div>
      <label>Número de sessões</label>
      <input type="number" min="1" max="100" [(ngModel)]="newTreatment.total_sessions">
    </div>
  </div>
  <label>Medicamentos do tratamento</label>
  <textarea rows="3" [(ngModel)]="newTreatment.medications" placeholder="Medicamentos a aplicar em cada sessão, posologia..."></textarea>
  <label>Observações</label>
  <textarea rows="2" [(ngModel)]="newTreatment.notes" placeholder="Frequência, cuidados..."></textarea>
  <div class="form-actions"><button type="button" class="btn" (click)="createTreatment()">Criar tratamento</button></div>
</div>
}

@if(treatments.length){
<div class="card table-wrap">
  <h3>Tratamentos do paciente</h3>
  <table>
    <tr><th>Medicamentos</th><th>Progresso</th><th>Médico</th><th>Sessões</th></tr>
    @for(t of treatments;track t.id){
      <tr>
        <td>{{summary(t.medications)}}</td>
        <td><span class="badge" [class.warn]="t.sessions_done < t.total_sessions">{{t.sessions_done}} de {{t.total_sessions}}</span></td>
        <td>{{t.doctor_user_name || '—'}}</td>
        <td>
          <div class="session-chips">
            @for(s of t.sessions;track s.id){
              <button type="button" class="btn btn-secondary btn-sm" (click)="openSession(s.id)">
                {{s.session_number}}ª · {{sessionStatusLabel(s.status)}}
              </button>
            }
          </div>
        </td>
      </tr>
    }
  </table>
</div>
}

<div class="card section-card">
  <div class="section-head">
    <h3>Anotações da Técnica de Enfermagem</h3>
    @if(current.tech_updated_at){<span class="hint">{{current.tech_user_name}} · {{current.tech_updated_at | dateBr:'datetime'}}</span>}
  </div>
  <textarea rows="4" [(ngModel)]="techNotes" [readonly]="!auth.canEditTechSection()" placeholder="Anotações da técnica de enfermagem..."></textarea>
  @if(auth.canEditTechSection()){
    <div class="form-actions"><button type="button" class="btn" (click)="saveSection('tech')">Salvar seção da técnica</button></div>
  }
</div>

@if(auth.canDispenseMedication()){
<div class="card">
  <h3>Dispensar medicamento</h3>
  <div class="grid grid-3">
    <div>
      <app-search-select
        fieldLabel="Produto"
        searchPath="/products"
        placeholder="Digite o nome do produto"
        [(ngModel)]="dispense.product_id"
        (ngModelChange)="onDispenseProductChange()"
      ></app-search-select>
    </div>
    <div><label>Lote</label><select [(ngModel)]="dispense.lot_id"><option [ngValue]="0">Selecione</option>@for(l of filteredLots;track l.id){<option [ngValue]="l.id">Lote {{l.lot_number}} · val {{l.expiration_date | dateBr}}</option>}</select></div>
    <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
    <div><label>Quantidade</label><input type="number" [(ngModel)]="dispense.quantity"></div>
    <div><label>Observação</label><input [(ngModel)]="dispense.notes"></div>
    <div class="form-actions"><button type="button" class="btn" (click)="dispenseMedication()">Dispensar</button></div>
  </div>
</div>
}

<div class="card section-card">
  <div class="section-head">
    <h3>Finalização da enfermagem</h3>
    @if(current.nursing_updated_at){<span class="hint">{{current.nursing_user_name}} · {{current.nursing_updated_at | dateBr:'datetime'}}</span>}
  </div>
  <textarea rows="3" [(ngModel)]="nursingNotes" [readonly]="!auth.canEditNursingSection()" placeholder="Observações finais da enfermagem..."></textarea>
  @if(auth.canEditNursingSection()){
    <div class="form-actions"><button type="button" class="btn" (click)="saveSection('nursing')">Finalizar enfermagem</button></div>
  }
</div>

<div class="card table-wrap">
  <h3>Medicamentos aplicados/repassados neste atendimento</h3>
  @if(current.exits.length){
  <table>
    <tr><th>Produto</th><th>Lote</th><th>Qtd</th><th>Data</th></tr>
    @for(e of current.exits;track e.id){
      <tr><td>{{e.product_name}}</td><td>{{e.lot_number}}</td><td>{{e.quantity}}</td><td>{{e.exit_date | dateBr}}</td></tr>
    }
  </table>
  }@else{<p class="hint">Nenhum medicamento dispensado neste atendimento.</p>}
</div>
}

@if(vitalsChartOpen){
<div class="modal-backdrop" (click)="closeVitalsChart()"></div>
<div class="modal card vitals-modal">
  <div class="section-head">
    <h3>Evolução dos sinais vitais — {{current?.patient_name}}</h3>
    <button type="button" class="btn btn-secondary btn-sm" (click)="closeVitalsChart()">Fechar</button>
  </div>
  <app-vitals-chart [points]="vitalsHistory"></app-vitals-chart>
</div>
}`,
  styles: [`
    .session-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .section-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; }
    .vitals-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 101; width: min(920px, 94vw); max-height: 90vh; overflow: auto; }
  `],
})
export class AttendanceComponent implements OnInit {
  readonly patientSearchParams = patientSearchParams;
  lots: any[] = [];
  history: AttendanceListItem[] = [];
  current: Attendance | null = null;
  error = '';

  selectedPatientId = 0;
  selectedPatientLabel = '';
  newDate = todayIsoBr();

  doctorNotes = '';
  prescription = '';
  externalPrescription = '';
  techNotes = '';
  nursingNotes = '';

  vitals = {
    systolic_bp: null as number | null,
    diastolic_bp: null as number | null,
    heart_rate: null as number | null,
    temperature: null as number | null,
    weight: null as number | null,
    height: null as number | null,
    spo2: null as number | null,
    glycemia: null as number | null,
    notes: '',
  };

  vitalsChartOpen = false;
  vitalsHistory: VitalSignPoint[] = [];

  dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };

  treatments: Treatment[] = [];
  newTreatment = { medications: '', total_sessions: 1, notes: '' };

  constructor(
    private api: ApiService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const attendanceId = Number(this.route.snapshot.queryParamMap.get('attendanceId'));
    if (attendanceId) {
      this.loadAttendance(attendanceId, true);
    }
    this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
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

  get bmiPreview(): string {
    const w = this.vitals.weight;
    const h = this.vitals.height;
    if (w == null || h == null || h <= 0) return '—';
    const bmi = w / ((h / 100) ** 2);
    return bmi.toFixed(1);
  }

  onPatientChange() {
    this.current = null;
    this.history = [];
    if (this.selectedPatientId) this.loadHistory();
  }

  loadHistory() {
    this.api
      .get<AttendanceListItem[]>('/attendances', { patient_id: this.selectedPatientId })
      .subscribe((r) => (this.history = r));
  }

  openAttendance() {
    this.error = '';
    if (!this.selectedPatientId) return;
    this.api
      .post<Attendance>('/attendances', {
        patient_id: this.selectedPatientId,
        attendance_date: this.newDate,
      })
      .subscribe({
        next: (a) => {
          this.setCurrent(a);
          this.loadHistory();
        },
        error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao abrir atendimento')),
      });
  }

  loadAttendance(id: number, fromDeepLink = false) {
    this.error = '';
    this.api.get<Attendance>(`/attendances/${id}`).subscribe({
      next: (a) => {
        this.selectedPatientId = a.patient_id;
        this.selectedPatientLabel = a.patient_name;
        if (fromDeepLink) {
          this.loadHistory();
        }
        this.setCurrent(a);
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao carregar atendimento')),
    });
  }

  private setCurrent(a: Attendance) {
    this.current = a;
    this.doctorNotes = a.doctor_notes || '';
    this.prescription = a.prescription || '';
    this.externalPrescription = a.external_prescription || '';
    this.techNotes = a.tech_notes || '';
    this.nursingNotes = a.nursing_notes || '';
    const v = a.vitals;
    this.vitals = {
      systolic_bp: v?.systolic_bp ?? null,
      diastolic_bp: v?.diastolic_bp ?? null,
      heart_rate: v?.heart_rate ?? null,
      temperature: v?.temperature ?? null,
      weight: v?.weight ?? null,
      height: v?.height ?? null,
      spo2: v?.spo2 ?? null,
      glycemia: v?.glycemia ?? null,
      notes: v?.notes || '',
    };
    this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
    this.loadTreatments();
  }

  saveVitals() {
    if (!this.current) return;
    this.error = '';
    this.api.put<Attendance>(`/attendances/${this.current.id}/vitals`, this.vitals).subscribe({
      next: (a) => this.setCurrent(a),
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar sinais vitais')),
    });
  }

  openVitalsChart() {
    if (!this.current) return;
    this.api.get<VitalSignPoint[]>(`/patients/${this.current.patient_id}/vital-signs`).subscribe({
      next: (r) => {
        this.vitalsHistory = r;
        this.vitalsChartOpen = true;
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao carregar histórico')),
    });
  }

  closeVitalsChart() {
    this.vitalsChartOpen = false;
  }

  printExternalPrescription() {
    if (!this.current) return;
    this.api.openPdf(`/attendances/${this.current.id}/external-prescription.pdf`);
  }

  loadTreatments() {
    if (!this.current) return;
    this.api
      .get<Treatment[]>('/treatments', { patient_id: this.current.patient_id })
      .subscribe((r) => (this.treatments = r));
  }

  createTreatment() {
    if (!this.current) return;
    this.error = '';
    if (!this.newTreatment.medications.trim()) {
      this.error = 'Informe os medicamentos do tratamento';
      return;
    }
    if (!this.newTreatment.total_sessions || this.newTreatment.total_sessions < 1) {
      this.error = 'Informe o número de sessões';
      return;
    }
    this.api.post<Treatment>(`/attendances/${this.current.id}/treatments`, this.newTreatment).subscribe({
      next: () => {
        this.newTreatment = { medications: '', total_sessions: 1, notes: '' };
        this.loadTreatments();
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao criar tratamento')),
    });
  }

  openSession(id: number) {
    this.router.navigate(['/sessoes', id]);
  }

  summary(text?: string) {
    const s = (text || '').trim();
    return s.length > 60 ? `${s.slice(0, 60)}…` : s || '—';
  }

  sessionStatusLabel(status: string) {
    switch (status) {
      case 'pendente':
        return 'Pendente';
      case 'aguardando_enfermagem':
        return 'Aguard. enfermagem';
      case 'concluido':
        return 'Concluída';
      default:
        return status;
    }
  }

  workflowLabel(status: string) {
    switch (status) {
      case 'aguardando_sinais_vitais': return 'Aguardando sinais vitais';
      case 'aguardando_medico': return 'Aguardando médico';
      case 'aguardando_tecnica': return 'Aguardando técnica';
      case 'aguardando_enfermagem': return 'Aguardando enfermagem';
      case 'concluido': return 'Concluído';
      default: return status;
    }
  }

  formatMoney(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  bookingStatusLabel(s: string) {
    switch (s) {
      case 'agendado': return 'Agendado';
      case 'presente': return 'Presente';
      case 'cancelado': return 'Cancelado';
      default: return s;
    }
  }

  paymentMethodLabel(m: string) {
    switch (m) {
      case 'pix': return 'PIX';
      case 'dinheiro': return 'Dinheiro';
      case 'cartao': return 'Cartão';
      case 'transferencia': return 'Transferência';
      default: return m;
    }
  }

  saveSection(section: 'doctor' | 'tech' | 'nursing') {
    if (!this.current) return;
    this.error = '';
    let body: any;
    if (section === 'doctor') {
      body = {
        notes: this.doctorNotes,
        prescription: this.prescription,
        external_prescription: this.externalPrescription,
      };
    } else if (section === 'tech') {
      body = { notes: this.techNotes };
    } else {
      body = { notes: this.nursingNotes };
    }
    this.api.put<Attendance>(`/attendances/${this.current.id}/${section}`, body).subscribe({
      next: (a) => this.setCurrent(a),
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao salvar anotações')),
    });
  }

  onDispenseProductChange() {
    this.dispense.lot_id = 0;
  }

  dispenseMedication() {
    if (!this.current) return;
    this.error = '';
    if (!this.dispense.product_id || !this.dispense.lot_id) {
      this.error = 'Selecione produto e lote';
      return;
    }
    this.api.post(`/attendances/${this.current.id}/exits`, this.dispense).subscribe({
      next: () => {
        this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
        this.api.get<any[]>('/lots').subscribe((r) => (this.lots = r));
        this.loadAttendance(this.current!.id);
      },
      error: (e) => (this.error = formatApiError(e.error?.detail, 'Erro ao dispensar medicamento')),
    });
  }
}
