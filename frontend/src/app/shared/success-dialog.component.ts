import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  template: `
@if (open) {
  <div class="modal-backdrop" (click)="close.emit()" role="presentation">
    <div
      class="modal-dialog success-dialog"
      role="dialog"
      aria-modal="true"
      (click)="$event.stopPropagation()"
    >
      <div class="modal-header">
        <h2 class="modal-title">{{ title }}</h2>
        <button type="button" class="modal-close" aria-label="Fechar" (click)="close.emit()">×</button>
      </div>
      <div class="modal-body">
        <p class="success-dialog-message">{{ message }}</p>
        <div class="form-actions">
          <button type="button" class="btn" (click)="close.emit()">OK</button>
        </div>
      </div>
    </div>
  </div>
}`,
  styles: [`
    .success-dialog { max-width: 420px; }
    .success-dialog-message { margin: 0 0 4px; }
  `],
})
export class SuccessDialogComponent {
  @Input() open = false;
  @Input() title = 'Salvo';
  @Input() message = 'Registro salvo com sucesso.';
  @Output() close = new EventEmitter<void>();
}
