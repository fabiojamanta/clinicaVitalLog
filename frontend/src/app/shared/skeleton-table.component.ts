import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton-table',
  standalone: true,
  template: `
<div class="card table-wrap skeleton-panel" aria-hidden="true">
  <div class="skeleton skeleton-line skeleton-title-bar"></div>
  <div class="skeleton-table">
    <div class="skeleton-row skeleton-row-head">
      @for (c of colRange; track c) {
        <div class="skeleton skeleton-cell"></div>
      }
    </div>
    @for (r of rowRange; track r) {
      <div class="skeleton-row">
        @for (c of colRange; track c; let ci = $index) {
          <div class="skeleton skeleton-cell" [style.width.%]="cellWidth(ci)"></div>
        }
      </div>
    }
  </div>
</div>
`,
})
export class SkeletonTableComponent {
  @Input() columns = 5;
  @Input() rows = 6;

  get colRange() {
    return Array.from({ length: this.columns }, (_, i) => i);
  }

  get rowRange() {
    return Array.from({ length: this.rows }, (_, i) => i);
  }

  cellWidth(index: number) {
    const widths = [92, 78, 85, 70, 88, 65, 80];
    return widths[index % widths.length];
  }
}
