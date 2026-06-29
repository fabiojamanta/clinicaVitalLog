import { Component } from '@angular/core';
import { formatApiError } from '../../core/api-error.util';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BRAND_NAME, LOGIN_BACKGROUND } from '../../shared/page-logos';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
<div class="login-page">
  <div class="login-hero" aria-hidden="true">
    <img class="login-hero-img" [src]="loginBackground" [alt]="brandName" />
  </div>
  <div class="login-panel">
    <div class="login-card">
      @if(error){<div class="error">{{error}}</div>}
      <label>Email</label><input [(ngModel)]="email" placeholder="seu@email.com" autocomplete="username">
      <label>Senha</label><input [(ngModel)]="password" type="password" placeholder="••••••••" autocomplete="current-password">
      <button type="button" class="btn btn-block" (click)="login()">Entrar</button>
    </div>
  </div>
</div>`,
})
export class LoginComponent {
  readonly brandName = BRAND_NAME;
  readonly loginBackground = LOGIN_BACKGROUND;
  email = '';
  password = '';
  error = '';
  constructor(private auth: AuthService, private router: Router) {}
  login() {
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigateByUrl('/'),
      error: (e) => this.error = formatApiError(e.error?.detail, 'Erro ao entrar'),
    });
  }
}
