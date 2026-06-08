import { Pipe, PipeTransform } from '@angular/core';
import { formatPhoneBr } from './format.util';

@Pipe({ name: 'phoneBr', standalone: true })
export class PhoneBrPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatPhoneBr(value);
  }
}
