import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { todayIsoBr } from '../../core/date-br.util';
import { AuthService } from '../../services/auth.service';

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

type Attendance = {
  id: number;
  patient_id: number;
  patient_name: string;
  attendance_date: string;
  doctor_notes?: string;
  prescription?: string;
  tech_notes?: string;
  nursing_notes?: string;
  doctor_user_name?: string;
  tech_user_name?: string;
  nursing_user_name?: string;
  doctor_updated_at?: string;
  tech_updated_at?: string;
  nursing_updated_at?: string;
  exits: AttendanceExit[];
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, DateBrPipe],
  template: `
<div class="top"><div class="page-title"><h1>Atendimento ao paciente</h1><p>Busque o paciente, registre anotações por equipe e dispense medicamentos.</p></div></div>
@if(error){<div class="error">{{error}}</div>}

<div class="card grid grid-3">
  <div>
    <label>Paciente</label>
    <select [(ngModel)]="selectedPatientId" (ngModelChange)="onPatientChange()">
      <option [ngValue]="0">Selecione</option>
      @for(p of patients;track p.id){<option [ngValue]="p.id">{{p.name}}</option>}
    </select>
  </div>
  <div>
    <label>Data do atendimento</label>
    <input type="date" [(ngModel)]="newDate">
  </div>
  <div class="form-actions">
    <button type="button" class="btn" [disabled]="!selectedPatientId" (click)="openAttendance()">Abrir atendimento</button>
  </div>
</div>

@if(selectedPatientId){
<div class="card table-wrap">
  <h3>Histórico de atendimentos</h3>
  @if(history.length){
  <table>
    <tr><th>Data</th><th>Registrado em</th><th>Ações</th></tr>
    @for(h of history;track h.id){
      <tr [class.row-active]="current?.id===h.id">
        <td>{{h.attendance_date | dateBr}}</td>
        <td>{{h.created_at | dateBr:'datetime'}}</td>
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
</div>

<div class="card section-card">
  <div class="section-head">
    <h3>Anotações do Médico e Prescrição</h3>
    @if(current.doctor_updated_at){<span class="hint">{{current.doctor_user_name}} · {{current.doctor_updated_at | dateBr:'datetime'}}</span>}
  </div>
  <label>Anotações</label>
  <textarea rows="4" [(ngModel)]="doctorNotes" [readonly]="!auth.canEditDoctorSection()" placeholder="Evolução, conduta..."></textarea>
  <label>Prescrição de medicamentos</label>
  <textarea rows="4" [(ngModel)]="prescription" [readonly]="!auth.canEditDoctorSection()" placeholder="Medicamentos prescritos, posologia..."></textarea>
  @if(auth.canEditDoctorSection()){
    <div class="form-actions"><button type="button" class="btn" (click)="saveSection('doctor')">Salvar seção do médico</button></div>
  }
</div>

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

<div class="card section-card">
  <div class="section-head">
    <h3>Anotações da Enfermagem</h3>
    @if(current.nursing_updated_at){<span class="hint">{{current.nursing_user_name}} · {{current.nursing_updated_at | dateBr:'datetime'}}</span>}
  </div>
  <textarea rows="4" [(ngModel)]="nursingNotes" [readonly]="!auth.canEditNursingSection()" placeholder="Anotações da enfermagem..."></textarea>
  @if(auth.canEditNursingSection()){
    <div class="form-actions"><button type="button" class="btn" (click)="saveSection('nursing')">Salvar seção da enfermagem</button></div>
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

@if(auth.canDispenseMedication()){
<div class="card">
  <h3>Dispensar medicamento</h3>
  <div class="grid grid-3">
    <div><label>Produto</label><select [(ngModel)]="dispense.product_id" (ngModelChange)="onDispenseProductChange()"><option [ngValue]="0">Selecione</option>@for(p of products;track p.id){<option [ngValue]="p.id">{{p.name}}</option>}</select></div>
    <div><label>Lote</label><select [(ngModel)]="dispense.lot_id"><option [ngValue]="0">Selecione</option>@for(l of filteredLots;track l.id){<option [ngValue]="l.id">Lote {{l.lot_number}} · val {{l.expiration_date | dateBr}}</option>}</select></div>
    <div><label>Saldo</label><input type="number" [ngModel]="selectedLotStock" readonly tabindex="-1"></div>
    <div><label>Quantidade</label><input type="number" [(ngModel)]="dispense.quantity"></div>
    <div><label>Observação</label><input [(ngModel)]="dispense.notes"></div>
    <div class="form-actions"><button type="button" class="btn" (click)="dispenseMedication()">Dispensar</button></div>
  </div>
</div>
}

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
}`,
  styles: [`
    .session-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  `],
})
export class AttendanceComponent implements OnInit {
  patients: any[] = [];
  products: any[] = [];
  lots: any[] = [];
  history: AttendanceListItem[] = [];
  current: Attendance | null = null;
  error = '';

  selectedPatientId = 0;
  newDate = todayIsoBr();

  doctorNotes = '';
  prescription = '';
  techNotes = '';
  nursingNotes = '';

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
    this.api.get<any[]>('/clients').subscribe((r) => {
      this.patients = r.filter((c) => c.client_type === 'paciente' && c.active);
      const attendanceId = Number(this.route.snapshot.queryParamMap.get('attendanceId'));
      if (attendanceId) {
        this.loadAttendance(attendanceId, true);
      }
    });
    this.api.get<any[]>('/products').subscribe((r) => (this.products = r));
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
        error: (e) => (this.error = e.error?.detail || 'Erro ao abrir atendimento'),
      });
  }

  loadAttendance(id: number, fromDeepLink = false) {
    this.error = '';
    this.api.get<Attendance>(`/attendances/${id}`).subscribe({
      next: (a) => {
        if (fromDeepLink) {
          this.selectedPatientId = a.patient_id;
          this.loadHistory();
        }
        this.setCurrent(a);
      },
      error: (e) => (this.error = e.error?.detail || 'Erro ao carregar atendimento'),
    });
  }

  private setCurrent(a: Attendance) {
    this.current = a;
    this.doctorNotes = a.doctor_notes || '';
    this.prescription = a.prescription || '';
    this.techNotes = a.tech_notes || '';
    this.nursingNotes = a.nursing_notes || '';
    this.dispense = { product_id: 0, lot_id: 0, quantity: 1, notes: '' };
    this.loadTreatments();
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
      error: (e) => (this.error = e.error?.detail || 'Erro ao criar tratamento'),
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

  saveSection(section: 'doctor' | 'tech' | 'nursing') {
    if (!this.current) return;
    this.error = '';
    let body: any;
    if (section === 'doctor') body = { notes: this.doctorNotes, prescription: this.prescription };
    else if (section === 'tech') body = { notes: this.techNotes };
    else body = { notes: this.nursingNotes };
    this.api.put<Attendance>(`/attendances/${this.current.id}/${section}`, body).subscribe({
      next: (a) => this.setCurrent(a),
      error: (e) => (this.error = e.error?.detail || 'Erro ao salvar anotações'),
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
      error: (e) => (this.error = e.error?.detail || 'Erro ao dispensar medicamento'),
    });
  }
}
