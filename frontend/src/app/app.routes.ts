import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { SuppliersComponent } from './pages/suppliers/suppliers.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { ProductsComponent } from './pages/products/products.component';
import { EntriesComponent } from './pages/entries/entries.component';
import { ExitsComponent } from './pages/exits/exits.component';
import { AttendanceComponent } from './pages/attendance/attendance.component';
import { AttendancePendingComponent } from './pages/attendance-pending/attendance-pending.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { ReportViewComponent } from './pages/reports/report-view.component';
import { UsersComponent } from './pages/users/users.component';
import { AuditComponent } from './pages/audit/audit.component';

const protectedRoute = [authGuard, roleGuard];

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: '', component: DashboardComponent, canActivate: protectedRoute },
  { path: 'fornecedores', component: SuppliersComponent, canActivate: protectedRoute },
  { path: 'clientes', component: ClientsComponent, canActivate: protectedRoute },
  { path: 'produtos', component: ProductsComponent, canActivate: protectedRoute },
  { path: 'entradas', component: EntriesComponent, canActivate: protectedRoute },
  { path: 'saidas', component: ExitsComponent, canActivate: protectedRoute },
  { path: 'atendimentos', component: AttendanceComponent, canActivate: protectedRoute },
  { path: 'atendimentos-pendentes', component: AttendancePendingComponent, canActivate: protectedRoute },
  { path: 'relatorios', component: ReportsComponent, canActivate: protectedRoute },
  { path: 'relatorios/:kind', component: ReportViewComponent, canActivate: protectedRoute },
  { path: 'usuarios', component: UsersComponent, canActivate: protectedRoute },
  { path: 'auditoria', component: AuditComponent, canActivate: protectedRoute },
  { path: '**', redirectTo: '' },
];
