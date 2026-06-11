import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-readonly-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
@if(show){
<div class="readonly-banner">Acesso somente consulta nesta tela. Inclusão e alteração não estão disponíveis.</div>
}`,
})
export class ReadonlyBannerComponent {
  @Input() show = false;
}
