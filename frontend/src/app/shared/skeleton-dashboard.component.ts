import { Component } from '@angular/core';

@Component({
  selector: 'app-skeleton-dashboard',
  standalone: true,
  template: `
<div class="grid grid-4" aria-hidden="true">
  @for (i of stats; track i) {
    <div class="card stat skeleton-stat">
      <div class="skeleton skeleton-line skeleton-stat-value"></div>
      <div class="skeleton skeleton-line skeleton-stat-label"></div>
    </div>
  }
</div>
<div class="grid grid-3">
  @for (p of panels; track p) {
    <section class="card dash-panel skeleton-panel-block">
      <div class="skeleton skeleton-line skeleton-panel-title"></div>
      @for (l of lines; track l) {
        <div class="skeleton skeleton-line skeleton-panel-line"></div>
      }
    </section>
  }
</div>
`,
})
export class SkeletonDashboardComponent {
  stats = [0, 1, 2, 3];
  panels = [0, 1, 2];
  lines = [0, 1, 2, 3];
}
