import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart,
  ChartConfiguration,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

export type VitalSignPoint = {
  attendance_date?: string;
  recorded_at: string;
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  spo2?: number | null;
  glycemia?: number | null;
};

@Component({
  selector: 'app-vitals-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="vitals-charts">
  @if(!points.length){<p class="hint">Sem histórico de sinais vitais para exibir.</p>}
  @else {
    <div class="chart-block"><h4>Pressão arterial (mmHg)</h4><canvas #bpCanvas></canvas></div>
    <div class="chart-block"><h4>Frequência cardíaca (bpm)</h4><canvas #hrCanvas></canvas></div>
    <div class="chart-block"><h4>Temperatura (°C)</h4><canvas #tempCanvas></canvas></div>
    <div class="chart-block"><h4>Peso (kg)</h4><canvas #weightCanvas></canvas></div>
    <div class="chart-block"><h4>SpO₂ (%)</h4><canvas #spo2Canvas></canvas></div>
    <div class="chart-block"><h4>Glicemia (mg/dL)</h4><canvas #glyCanvas></canvas></div>
  }
</div>`,
  styles: [`
    .vitals-charts { display: grid; gap: 16px; }
    .chart-block canvas { max-height: 220px; }
    .chart-block h4 { margin: 0 0 8px; font-size: 0.95rem; }
  `],
})
export class VitalsChartComponent implements OnChanges, OnDestroy {
  @Input() points: VitalSignPoint[] = [];

  @ViewChild('bpCanvas') bpCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hrCanvas') hrCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tempCanvas') tempCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('weightCanvas') weightCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('spo2Canvas') spo2Canvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('glyCanvas') glyCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['points']) {
      setTimeout(() => this.renderCharts(), 0);
    }
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  private labels(): string[] {
    return this.points.map((p) => {
      const d = p.attendance_date || p.recorded_at?.slice(0, 10);
      if (!d) return '—';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    });
  }

  private destroyCharts() {
    for (const c of this.charts) c.destroy();
    this.charts = [];
  }

  private lineChart(
    canvas: HTMLCanvasElement | undefined,
    datasets: ChartConfiguration<'line'>['data']['datasets'],
  ) {
    if (!canvas) return;
    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels: this.labels(), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: false } },
      },
    });
    this.charts.push(chart);
  }

  private renderCharts() {
    this.destroyCharts();
    if (!this.points.length) return;

    this.lineChart(this.bpCanvas?.nativeElement, [
      {
        label: 'Sistólica',
        data: this.points.map((p) => p.systolic_bp ?? null),
        borderColor: '#c0392b',
        tension: 0.2,
        spanGaps: true,
      },
      {
        label: 'Diastólica',
        data: this.points.map((p) => p.diastolic_bp ?? null),
        borderColor: '#2980b9',
        tension: 0.2,
        spanGaps: true,
      },
    ]);

    this.lineChart(this.hrCanvas?.nativeElement, [{
      label: 'FC',
      data: this.points.map((p) => p.heart_rate ?? null),
      borderColor: '#8e44ad',
      tension: 0.2,
      spanGaps: true,
    }]);

    this.lineChart(this.tempCanvas?.nativeElement, [{
      label: 'Temp.',
      data: this.points.map((p) => p.temperature ?? null),
      borderColor: '#d35400',
      tension: 0.2,
      spanGaps: true,
    }]);

    this.lineChart(this.weightCanvas?.nativeElement, [{
      label: 'Peso',
      data: this.points.map((p) => p.weight ?? null),
      borderColor: '#27ae60',
      tension: 0.2,
      spanGaps: true,
    }]);

    this.lineChart(this.spo2Canvas?.nativeElement, [{
      label: 'SpO₂',
      data: this.points.map((p) => p.spo2 ?? null),
      borderColor: '#16a085',
      tension: 0.2,
      spanGaps: true,
    }]);

    this.lineChart(this.glyCanvas?.nativeElement, [{
      label: 'Glicemia',
      data: this.points.map((p) => p.glycemia ?? null),
      borderColor: '#2c3e50',
      tension: 0.2,
      spanGaps: true,
    }]);
  }
}
