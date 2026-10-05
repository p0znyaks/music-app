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
  styleUrl: './empty-state.component.css',
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
