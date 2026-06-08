import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { DateBrPipe } from '../../core/date-br.pipe';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { PAGE_LOGOS } from '../../shared/page-logos';
import { SkeletonDashboardComponent } from '../../shared/skeleton-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DateBrPipe, PageHeaderComponent, SkeletonDashboardComponent],
  template: `
<app-page-header
  title="Dashboard"
  description="Alertas operacionais de estoque e vencimento."
  [logoSrc]="logo"
  logoAlt="Dashboard"
/>
@if(!data){<app-skeleton-dashboard />}
@if(data){
<div class="grid grid-4">
  <div class="card stat"><b>{{data?.total_products||0}}</b><span>Produtos cadastrados</span></div>
  <div class="card stat"><b>{{data?.low_stock_count||0}}</b><span>Estoque baixo</span></div>
  <div class="card stat"><b>{{data?.near_expiration_count||0}}</b><span>Próximos do vencimento</span></div>
  <div class="card stat"><b>{{data?.expired_count||0}}</b><span>Vencidos bloqueados</span></div>
</div>
<div class="grid grid-3">
  <section class="card dash-panel">
    <h3 class="dash-section-title">Estoque baixo</h3>
    @for (i of data?.low_stock; track i.product_id) {
      <div class="dash-item dash-item-ok">
        <div class="dash-product-name">{{ i.name }}</div>
        <div class="dash-details">
          <div class="dash-detail-line">Em Estoque: {{ i.current_stock }}</div>
          <div class="dash-detail-line">Estoque Mínimo: {{ i.minimum_stock }}</div>
        </div>
      </div>
    } @empty {
      <p class="empty">Sem alertas.</p>
    }
  </section>
  <section class="card dash-panel">
    <h3 class="dash-section-title">Próximos do vencimento</h3>
    @for (i of data?.near_expiration; track i.lot_id) {
      <div class="dash-item dash-item-warn">
        <div class="dash-product-name">{{ i.product }}</div>
        <div class="dash-details">
          <div class="dash-detail-line">Lote: {{ i.lot_number }}</div>
          <div class="dash-detail-line">Data: {{ i.expiration_date | dateBr }}</div>
          <div class="dash-detail-line">Qtde: {{ i.current_stock }}</div>
        </div>
      </div>
    } @empty {
      <p class="empty">Sem alertas.</p>
    }
  </section>
  <section class="card dash-panel">
    <h3 class="dash-section-title">Vencidos</h3>
    @for (i of data?.expired; track i.lot_id) {
      <div class="dash-item dash-item-danger">
        <div class="dash-product-name">{{ i.product }}</div>
        <div class="dash-details">
          <div class="dash-detail-line">Lote: {{ i.lot_number }}</div>
          <div class="dash-detail-line">Vencido em: {{ i.expiration_date | dateBr }}</div>
          <div class="dash-detail-line">Qtde: {{ i.current_stock }}</div>
        </div>
      </div>
    } @empty {
      <p class="empty">Sem alertas.</p>
    }
  </section>
</div>
}`,
})
export class DashboardComponent implements OnInit {
  logo = PAGE_LOGOS.dashboard;
  data: any;
  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.get<any>('/dashboard').subscribe((r) => (this.data = r));
  }
}
