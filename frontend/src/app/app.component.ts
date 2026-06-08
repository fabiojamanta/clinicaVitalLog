import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { BRAND_LOGO, BRAND_NAME } from './shared/page-logos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
@if(isLoginPage()){ <router-outlet /> } @else {
<div class="layout">
  @if(menuOpen){ <button type="button" class="nav-backdrop" aria-label="Fechar menu" (click)="closeMenu()"></button> }
  <nav class="navbar" aria-label="Menu principal">
    <div class="logo">
      <a routerLink="/" class="logo-link" (click)="closeMenu()">
        <img class="nav-brand-logo" [src]="brandLogo" [alt]="brandName" />
      </a>
    </div>

    <button
      type="button"
      class="nav-toggle"
      [class.is-open]="menuOpen"
      [attr.aria-expanded]="menuOpen"
      aria-controls="nav-panel"
      aria-label="Abrir ou fechar menu"
      (click)="toggleMenu()"
    >
      <span></span><span></span><span></span>
    </button>

    <div id="nav-panel" class="nav-panel" [class.is-open]="menuOpen">
      <ul class="nav-links">
        @if(auth.canShowMenuItem('dashboard')){<li><a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" (click)="closeMenu()">Dashboard</a></li>}
        @if(auth.canShowMenuItem('fornecedores')){<li><a routerLink="/fornecedores" routerLinkActive="active" (click)="closeMenu()">Fornecedores</a></li>}
        @if(auth.canShowMenuItem('clientes')){<li><a routerLink="/clientes" routerLinkActive="active" (click)="closeMenu()">Clientes</a></li>}
        @if(auth.canShowMenuItem('produtos')){<li><a routerLink="/produtos" routerLinkActive="active" (click)="closeMenu()">Produtos</a></li>}
        @if(auth.canShowMenuItem('entradas')){<li><a routerLink="/entradas" routerLinkActive="active" (click)="closeMenu()">Entradas</a></li>}
        @if(auth.canShowMenuItem('saidas')){<li><a routerLink="/saidas" routerLinkActive="active" (click)="closeMenu()">Saídas</a></li>}
        @if(auth.canShowMenuItem('atendimentos')){<li><a routerLink="/atendimentos" routerLinkActive="active" (click)="closeMenu()">Atendimentos</a></li>}
        @if(auth.canShowMenuItem('atendimentos_pendentes')){<li><a routerLink="/atendimentos-pendentes" routerLinkActive="active" (click)="closeMenu()">Atendimentos Pendentes</a></li>}
        @if(auth.canShowMenuItem('relatorios')){<li><a routerLink="/relatorios" routerLinkActive="active" (click)="closeMenu()">Relatórios</a></li>}
        @if(auth.canShowMenuItem('usuarios')){<li><a routerLink="/usuarios" routerLinkActive="active" (click)="closeMenu()">Usuários</a></li>}
        @if(auth.canShowMenuItem('auditoria')){<li><a routerLink="/auditoria" routerLinkActive="active" (click)="closeMenu()">Auditoria</a></li>}
      </ul>

      <div class="nav-actions">
        @if(auth.user().name){
          <p class="nav-user">{{ auth.user().name }}<span>{{ auth.roleDisplay() }}</span></p>
        }
        <button type="button" class="nav-theme-btn" (click)="theme.toggle()">{{ theme.label() }}</button>
        <a href="#" class="nav-cta" (click)="logout($event)">Sair</a>
      </div>
    </div>
  </nav>
  <main class="main"><router-outlet /></main>
</div>}`,
})
export class AppComponent {
  menuOpen = false;
  readonly brandName = BRAND_NAME;
  readonly brandLogo = BRAND_LOGO;

  constructor(
    private router: Router,
    public auth: AuthService,
    public theme: ThemeService,
  ) {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.closeMenu());
  }

  isLoginPage() {
    return this.router.url.startsWith('/login');
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  logout(e: Event) {
    e.preventDefault();
    this.closeMenu();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
