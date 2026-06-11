import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="signature-pad">
  <canvas
    #canvas
    class="signature-canvas"
    (pointerdown)="onPointerDown($event)"
    (pointermove)="onPointerMove($event)"
    (pointerup)="onPointerUp($event)"
    (pointercancel)="onPointerUp($event)"
  ></canvas>
  <p class="hint signature-hint">Assine no quadro acima com o dedo ou mouse.</p>
  <div class="form-actions signature-actions">
    <button type="button" class="btn btn-secondary" (click)="clear()">Limpar</button>
    <button type="button" class="btn" [disabled]="!hasInk" (click)="confirm()">Confirmar assinatura</button>
  </div>
</div>`,
  styles: [`
    .signature-canvas {
      width: 100%;
      height: 180px;
      border: 1px dashed var(--border, #9aa0a6);
      border-radius: 8px;
      background: #fff;
      touch-action: none;
      cursor: crosshair;
      display: block;
    }
    .signature-hint { margin: 6px 0 0; }
    .signature-actions { margin-top: 10px; display: flex; gap: 8px; }
  `],
})
export class SignaturePadComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() signed = new EventEmitter<string>();

  hasInk = false;
  private drawing = false;
  private ctx!: CanvasRenderingContext2D;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = '#1a237e';
    this.fillBackground();
  }

  private fillBackground() {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.save();
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();
  }

  private pos(e: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onPointerDown(e: PointerEvent) {
    e.preventDefault();
    this.canvasRef.nativeElement.setPointerCapture(e.pointerId);
    this.drawing = true;
    const { x, y } = this.pos(e);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  onPointerMove(e: PointerEvent) {
    if (!this.drawing) return;
    e.preventDefault();
    const { x, y } = this.pos(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.hasInk = true;
  }

  onPointerUp(e: PointerEvent) {
    if (!this.drawing) return;
    this.drawing = false;
    const { x, y } = this.pos(e);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  clear() {
    this.fillBackground();
    this.hasInk = false;
  }

  confirm() {
    if (!this.hasInk) return;
    this.signed.emit(this.canvasRef.nativeElement.toDataURL('image/png'));
  }
}
