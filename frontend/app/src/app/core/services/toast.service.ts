import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly message = signal<string | null>(null);

  show(text: string, durationMs = 2800): void {
    this.message.set(text);
    window.setTimeout(() => this.message.set(null), durationMs);
  }
}
