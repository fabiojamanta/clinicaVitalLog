import { Pipe, PipeTransform } from '@angular/core';
import { formatCpfCnpj } from './format.util';

@Pipe({ name: 'cpfCnpjBr', standalone: true })
export class CpfCnpjBrPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatCpfCnpj(value);
  }
}
