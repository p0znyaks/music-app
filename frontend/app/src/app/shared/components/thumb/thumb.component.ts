import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Which placeholder to draw when a track has no artwork. */
export type ThumbVariant = 'cover' | 'avatar' | 'queue';

/**
 * Artwork with a built-in placeholder.
 *
 * Every screen used to open-code `@if (url) { <img> } @else { <div class="*-ph"> }`
 * and the copies drifted: four sizes, three class names, inconsistent `aria-hidden`.
 */
@Component({
  selector: 'app-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'thumb',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  template: `
    @if (src()) {
      <img [src]="src()!" [alt]="alt()" [attr.width]="size()" [attr.height]="size()" />
    } @else {
      <div [class]="'thumb-ph ' + variant() + '-ph'" aria-hidden="true"></div>
    }
  `,
  styles: `
    :host {
      display: block;
      flex-shrink: 0;
    }
    img,
    .thumb-ph {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .cover-ph,
    .avatar-ph,
    .queue-thumb-ph {
      border-radius: var(--r-sm);
      background: var(--bg-hover);
    }
    .avatar-ph {
      border-radius: 50%;
    }
  `,
})
export class ThumbComponent {
  /** Artwork URL. Null/empty renders the placeholder. */
  readonly src = input<string | null | undefined>(null);

  /** Alternative text for the artwork. */
  readonly alt = input('');

  /** Square edge length in pixels. */
  readonly size = input(48);

  /** Placeholder style to use when {@link src} is empty. */
  readonly variant = input<ThumbVariant>('cover');
}
