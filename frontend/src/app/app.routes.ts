import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SuppliersComponent } from './pages/suppliers/suppliers.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ProductsComponent } from './pages/products/products.component';
import { EntriesComponent } from './pages/entries/entries.component';
import { ExitsComponent } from './pages/exits/exits.component';
import { AttendanceHubComponent } from './pages/attendance/attendance-hub.component';
import { AttendanceHistoryComponent } from './pages/attendance/attendance-history.component';
import { AttendanceDoctorComponent } from './pages/attendance/attendance-doctor.component';
import { AttendanceTechComponent } from './pages/attendance/attendance-tech.component';
import { AttendanceVitalsComponent } from './pages/attendance/attendance-vitals.component';
import { AttendanceDispenseComponent } from './pages/attendance/attendance-dispense.component';
import { AttendanceNursingFinalizeComponent } from './pages/attendance/attendance-nursing-finalize.component';
import { AttendancePendingComponent } from './pages/attendance-pending/attendance-pending.component';
import { BookingsComponent } from './pages/bookings/bookings.component';
import { TreatmentSessionHubComponent } from './pages/treatment-session/treatment-session-hub.component';
import { TreatmentSessionMedicationsComponent } from './pages/treatment-session/treatment-session-medications.component';
import { TreatmentSessionTechComponent } from './pages/treatment-session/treatment-session-tech.component';
import { TreatmentSessionSignatureComponent } from './pages/treatment-session/treatment-session-signature.component';
import { TreatmentSessionNursingComponent } from './pages/treatment-session/treatment-session-nursing.component';
import { PublicSignComponent } from './pages/public-sign/public-sign.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { ReportViewComponent } from './pages/reports/report-view.component';
import { UsersComponent } from './pages/users/users.component';
import { AuditComponent } from './pages/audit/audit.component';
import { PermissionsComponent } from './pages/permissions/permissions.component';
import { ProfilesComponent } from './pages/profiles/profiles.component';

const protectedRoute = [authGuard, roleGuard];

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'assinar/:token', component: PublicSignComponent },
  { path: '', component: DashboardComponent, canActivate: protectedRoute },
  { path: 'fornecedores', component: SuppliersComponent, canActivate: protectedRoute },
  { path: 'clientes', component: ClientsComponent, canActivate: protectedRoute },
  { path: 'produtos', component: ProductsComponent, canActivate: protectedRoute },
  { path: 'entradas', component: EntriesComponent, canActivate: protectedRoute },
  { path: 'saidas', component: ExitsComponent, canActivate: protectedRoute },
  { path: 'reservas', component: BookingsComponent, canActivate: protectedRoute },
  { path: 'atendimentos', component: AttendanceHubComponent, canActivate: protectedRoute },
  { path: 'atendimentos/historico', component: AttendanceHistoryComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/sinais-vitais', component: AttendanceVitalsComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/medico', component: AttendanceDoctorComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/tecnica', component: AttendanceTechComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/dispensar', component: AttendanceDispenseComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/finalizar', component: AttendanceNursingFinalizeComponent, canActivate: protectedRoute },
  { path: 'atendimentos/:id/enfermagem', redirectTo: 'atendimentos/:id/sinais-vitais', pathMatch: 'full' },
  { path: 'atendimentos-pendentes', component: AttendancePendingComponent, canActivate: protectedRoute },
  { path: 'sessoes/:id', component: TreatmentSessionHubComponent, canActivate: protectedRoute },
  { path: 'sessoes/:id/medicamentos', component: TreatmentSessionMedicationsComponent, canActivate: protectedRoute },
  { path: 'sessoes/:id/aplicacao', component: TreatmentSessionTechComponent, canActivate: protectedRoute },
  { path: 'sessoes/:id/assinatura', component: TreatmentSessionSignatureComponent, canActivate: protectedRoute },
  { path: 'sessoes/:id/enfermagem', component: TreatmentSessionNursingComponent, canActivate: protectedRoute },
  { path: 'relatorios', component: ReportsComponent, canActivate: protectedRoute },
  { path: 'relatorios/:kind', component: ReportViewComponent, canActivate: protectedRoute },
  { path: 'usuarios', component: UsersComponent, canActivate: protectedRoute },
  { path: 'perfis', component: ProfilesComponent, canActivate: protectedRoute },
  { path: 'permissoes', component: PermissionsComponent, canActivate: protectedRoute },
  { path: 'auditoria', component: AuditComponent, canActivate: protectedRoute },
  { path: '**', redirectTo: '' },
];
