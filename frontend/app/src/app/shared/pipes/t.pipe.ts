import { Pipe, PipeTransform, inject } from '@angular/core';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private readonly settings = inject(AppSettingsService);

  transform(key: string): string {
    return this.settings.t(key);
  }
}
