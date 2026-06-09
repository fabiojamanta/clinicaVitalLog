import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PAGE_LOGOS } from '../../shared/page-logos';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [RouterLink],
  template: `
<div class="top reports-page">
  <div class="page-title">
    <h1>Relatórios</h1>
    <p>Consulte os dados em tela e exporte para PDF quando precisar.</p>
  </div>
</div>
<div class="grid grid-3">
  <article class="card">
    <h3>Estoque atual</h3>
    <p>Produtos, estoque atual, mínimo e status.</p>
    <a class="btn" routerLink="/relatorios/estoque-atual">Abrir relatório</a>
  </article>
  <article class="card">
    <h3>Vencimentos</h3>
    <p>Lotes, validade, dias restantes e quantidade.</p>
    <a class="btn" routerLink="/relatorios/vencimentos">Abrir relatório</a>
  </article>
  <article class="card">
    <h3>Saídas</h3>
    <p>Histórico de retiradas por produto, lote e cliente.</p>
    <a class="btn" routerLink="/relatorios/saidas">Abrir relatório</a>
  </article>
  <article class="card report-card">
    <img class="report-card-logo" [src]="logos.produto" alt="Produtos" />
    <h3>Produtos</h3>
    <p>Cadastro de produtos, fornecedor, estoque e alertas.</p>
    <a class="btn" routerLink="/relatorios/produtos">Abrir relatório</a>
  </article>
  <article class="card report-card">
    <img class="report-card-logo" [src]="logos.fornecedor" alt="Fornecedores" />
    <h3>Fornecedores</h3>
    <p>Cadastro de fornecedores e quantidade de produtos vinculados.</p>
    <a class="btn" routerLink="/relatorios/fornecedores">Abrir relatório</a>
  </article>
  <article class="card report-card">
    <img class="report-card-logo" [src]="logos.cliente" alt="Clientes" />
    <h3>Clientes</h3>
    <p>Clientes cadastrados por tipo e situação.</p>
    <a class="btn" routerLink="/relatorios/clientes">Abrir relatório</a>
  </article>
</div>
`,
})
export class ReportsComponent {
  logos = PAGE_LOGOS;
}
