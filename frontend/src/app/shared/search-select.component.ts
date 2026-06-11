import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  forwardRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchSelectComponent),
      multi: true,
    },
  ],
  template: `
<div class="search-select" [class.open]="open" [class.disabled]="disabled">
  @if (fieldLabel) {
    <label>{{ fieldLabel }}</label>
  }
  <div class="search-select-control">
    <input
      type="text"
      [(ngModel)]="query"
      (ngModelChange)="onQueryChange()"
      (focus)="onFocus()"
      (blur)="onBlur()"
      [placeholder]="placeholder"
      [disabled]="disabled"
      autocomplete="off"
    />
    @if (hasValue && allowClear && !disabled) {
      <button type="button" class="search-select-clear" tabindex="-1" (mousedown)="clear($event)" aria-label="Limpar">×</button>
    }
  </div>
  @if (open && !disabled) {
    <ul class="search-select-dropdown" role="listbox">
      @if (loading) {
        <li class="search-select-hint">Buscando...</li>
      } @else if (query.trim().length < minChars) {
        <li class="search-select-hint">Digite pelo menos {{ minChars }} caracteres para buscar</li>
      } @else if (!results.length) {
        <li class="search-select-hint">Nenhum resultado encontrado</li>
      } @else {
        @for (item of results; track trackItem(item)) {
          <li role="option" (mousedown)="selectItem(item, $event)">{{ formatLabel(item) }}</li>
        }
      }
    </ul>
  }
</div>`,
  styles: [`
    .search-select {
      position: relative;
      width: 100%;
    }
    .search-select label {
      display: block;
      margin-bottom: 6px;
    }
    .search-select-control {
      position: relative;
    }
    .search-select-control input {
      width: 100%;
      padding-right: 2rem;
    }
    .search-select-clear {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: var(--muted);
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 0 4px;
    }
    .search-select-clear:hover {
      color: var(--text);
    }
    .search-select-dropdown {
      position: absolute;
      z-index: 120;
      left: 0;
      right: 0;
      top: calc(100% + 4px);
      margin: 0;
      padding: 6px 0;
      list-style: none;
      max-height: 240px;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: var(--shadow-md);
    }
    .search-select-hint {
      padding: 10px 14px;
      color: var(--muted);
      font-size: 13px;
      cursor: default;
    }
    .search-select-dropdown li[role='option'] {
      padding: 10px 14px;
      cursor: pointer;
    }
    .search-select-dropdown li[role='option']:hover {
      background: color-mix(in srgb, var(--primary) 10%, transparent);
    }
    .search-select.disabled {
      opacity: 0.7;
    }
  `],
})
export class SearchSelectComponent implements ControlValueAccessor {
  private api = inject(ApiService);
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  @Input() fieldLabel = '';
  @Input() placeholder = 'Digite para buscar';
  @Input() searchPath = '';
  @Input() queryParams: Record<string, string | number | boolean | null | undefined> = {};
  @Input() labelKey = 'name';
  @Input() valueKey = 'id';
  @Input() minChars = 3;
  @Input() allowClear = true;
  @Input() disabled = false;
  @Input() labelFn?: (item: Record<string, unknown>) => string;
  @Input() resultFilter?: (item: Record<string, unknown>) => boolean;

  @Input() set initialLabel(value: string | null | undefined) {
    const label = (value ?? '').trim();
    if (!label) return;
    this.selectedLabel = label;
    if (!this.focused) this.query = label;
  }

  @Output() itemSelected = new EventEmitter<Record<string, unknown>>();

  query = '';
  results: Record<string, unknown>[] = [];
  open = false;
  loading = false;
  focused = false;
  selectedLabel = '';
  value: number | null = null;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  get hasValue() {
    return this.value != null && this.value > 0;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
    }
  }

  writeValue(value: number | null): void {
    this.value = value != null && value > 0 ? value : null;
    if (!this.value && !this.focused) {
      this.query = '';
      this.selectedLabel = '';
    }
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  trackItem(item: Record<string, unknown>) {
    return item[this.valueKey];
  }

  formatLabel(item: Record<string, unknown>): string {
    if (this.labelFn) return this.labelFn(item);
    return String(item[this.labelKey] ?? '');
  }

  onFocus() {
    this.focused = true;
    this.open = true;
    if (this.selectedLabel && this.query === this.selectedLabel) {
      this.query = '';
    }
    if (this.query.trim().length >= this.minChars) {
      this.scheduleSearch(this.query.trim());
    }
  }

  onBlur() {
    this.focused = false;
    this.onTouched();
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      this.open = false;
      if (this.hasValue && this.selectedLabel) {
        this.query = this.selectedLabel;
      } else if (!this.hasValue) {
        this.query = '';
      }
    }, 150);
  }

  onQueryChange() {
    if (this.hasValue && this.query !== this.selectedLabel) {
      this.value = null;
      this.selectedLabel = '';
      this.onChange(this.value ?? 0);
    }
    this.open = true;
    const q = this.query.trim();
    if (q.length < this.minChars) {
      this.results = [];
      this.loading = false;
      return;
    }
    this.scheduleSearch(q);
  }

  clear(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.value = null;
    this.selectedLabel = '';
    this.query = '';
    this.results = [];
    this.open = false;
    this.onChange(this.value ?? 0);
    this.onTouched();
  }

  selectItem(item: Record<string, unknown>, event: Event) {
    event.preventDefault();
    const id = Number(item[this.valueKey]);
    const label = this.formatLabel(item);
    this.value = id;
    this.selectedLabel = label;
    this.query = label;
    this.open = false;
    this.onChange(id);
    this.itemSelected.emit(item);
    this.onTouched();
  }

  private scheduleSearch(q: string) {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.loading = true;
    this.searchTimer = setTimeout(() => this.runSearch(q), 300);
  }

  private runSearch(q: string) {
    if (!this.searchPath) {
      this.loading = false;
      this.results = [];
      return;
    }
    this.api.get<Record<string, unknown>[]>(this.searchPath, { q, ...this.queryParams }).subscribe({
      next: (rows) => {
        this.results = this.resultFilter ? rows.filter(this.resultFilter) : rows;
        this.loading = false;
      },
      error: () => {
        this.results = [];
        this.loading = false;
      },
    });
  }
}
