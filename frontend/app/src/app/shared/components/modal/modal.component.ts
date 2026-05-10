import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="backdrop" (click)="onBackdrop()" aria-hidden="true"></div>
      <div class="dialog-wrap" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="dialog" (click)="$event.stopPropagation()">
          <h2 class="title" id="modal-title">{{ title() }}</h2>
          <div class="body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 100;
      animation: fade-in 0.2s ease;
    }
    .dialog-wrap {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 101;
      padding: 1rem;
      pointer-events: none;
      animation: fade-in 0.2s ease;
    }
    .dialog {
      pointer-events: auto;
      width: 100%;
      max-width: 420px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.25rem 1.5rem;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
      animation: scale-in 0.22s ease;
    }
    .title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--accent);
    }
    .body {
      color: var(--accent-dim);
      font-size: 0.95rem;
    }
    @keyframes fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes scale-in {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
  `,
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly isOpen = input(false);
  readonly closed = output<void>();

  onBackdrop(): void {
    this.closed.emit();
  }
}
