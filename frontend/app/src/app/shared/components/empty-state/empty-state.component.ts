import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../pipes/t.pipe';

/**
 * "Nothing here yet" block.
 *
 * Five screens had five different ways of saying it — some with an emoji, some
 * with a nested title/subtitle pair, some a bare paragraph.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      @if (emoji()) {
        <div class="empty-icon" aria-hidden="true">{{ emoji() }}</div>
      }
      <p class="empty-title">{{ titleKey() | t }}</p>
      @if (subKey()) {
        <p class="empty-sub">{{ subKey()! | t }}</p>
      }
      @if (actionKey()) {
        <button type="button" class="gen-btn" (click)="action.emit()">
          {{ actionKey()! | t }}
        </button>
      }
    </div>
  `,
  styles: `
    .empty {
      text-align: center;
      padding: 4rem 1.5rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      max-width: 400px;
      margin: 2rem auto;
    }
    .empty-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 1rem;
      opacity: 0.85;
    }
    .empty-title {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
    }
    .empty-sub {
      color: var(--accent-dim);
      font-size: 0.9rem;
    }
    .gen-btn {
      margin-top: 1.25rem;
      padding: 0.75rem 2rem;
      border: 1px solid var(--border);
      border-radius: var(--r-pill);
      background: var(--bg-card);
      color: var(--accent);
      font-size: 1rem;
      cursor: pointer;
      transition:
        transform 0.2s ease,
        background-color 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }
    .gen-btn:hover:not(:disabled) {
      transform: translateY(-1px) scale(1.03);
      background: var(--bg-hover);
      border-color: var(--accent-dim);
      box-shadow: var(--shadow-pop);
    }
    .gen-btn:active:not(:disabled) {
      transform: scale(0.97);
    }
    .gen-btn:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
})
export class EmptyStateComponent {
  /** Decorative emoji shown above the title. */
  readonly emoji = input('');

  /** Translation key for the main line. */
  readonly titleKey = input.required<string>();

  /** Optional translation key for the secondary line. */
  readonly subKey = input<string | null>(null);

  /** Optional translation key for a call-to-action button. */
  readonly actionKey = input<string | null>(null);

  /** Emitted when the action button is pressed. */
  readonly action = output<void>();
}
