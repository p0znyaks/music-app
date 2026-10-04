import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Names of the icons that appeared duplicated across screens.
 * Anything used once stays inline — extracting it would only move code around.
 */
export type IconName =
  'play' | 'pause' | 'search' | 'expand' | 'chevron-left' | 'chevron-right' | 'heart' | 'eye';

/** Icons that render as a filled shape, the rest are stroked outlines. */
const FILLED: ReadonlySet<IconName> = new Set<IconName>(['play', 'pause']);

/** Natural size each icon was drawn at; used when `size` is omitted. */
const NATURAL: Record<IconName, number> = {
  play: 16,
  pause: 24,
  search: 24,
  expand: 24,
  'chevron-left': 24,
  'chevron-right': 24,
  heart: 20,
  eye: 24,
};

/**
 * Renders one of the shared UI icons.
 *
 * Fill/stroke styling is derived from {@link IconName} so callers never repeat
 * `fill="currentColor"` or `stroke-width`, which is what allowed the copies to
 * drift apart in the first place.
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.display]': "'inline-flex'",
    '[style.width.px]': 'size() || naturalSize()',
    '[style.height.px]': 'size() || naturalSize()',
    'aria-hidden': 'true',
  },
  template: `
    @switch (name()) {
      @case ('play') {
        <svg
          [attr.viewBox]="viewBox()"
          [attr.fill]="paint()"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <path d="M4 2l10 6-10 6V2z" />
        </svg>
      }
      @case ('pause') {
        <svg
          [attr.viewBox]="viewBox()"
          [attr.fill]="paint()"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <rect x="6" y="4" width="4" height="16" rx="1" />
          <rect x="14" y="4" width="4" height="16" rx="1" />
        </svg>
      }
      @case ('search') {
        <svg
          [attr.viewBox]="viewBox()"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
      }
      @case ('expand') {
        <svg
          [attr.viewBox]="viewBox()"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <polyline points="16 3 21 3 21 8" />
          <line x1="4" y1="20" x2="21" y2="3" />
          <polyline points="21 16 21 21 16 21" />
          <line x1="15" y1="15" x2="21" y2="21" />
          <line x1="4" y1="4" x2="9" y2="9" />
        </svg>
      }
      @case ('chevron-left') {
        <svg
          [attr.viewBox]="viewBox()"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <path d="M14.5 6.5L9 12l5.5 5.5" />
        </svg>
      }
      @case ('chevron-right') {
        <svg
          [attr.viewBox]="viewBox()"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <path d="M9.5 6.5L15 12l-5.5 5.5" />
        </svg>
      }
      @case ('heart') {
        <svg
          [attr.viewBox]="viewBox()"
          [attr.fill]="filled() ? 'currentColor' : 'none'"
          [attr.stroke]="filled() ? 'none' : 'currentColor'"
          stroke-width="2"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <path
            d="M8 14l-1.09-.64C3.18 11.36 1 9.28 1 6.5 1 4.02 3.02 2 5.5 2c1.64 0 3.09.81 4 2.09C10.41 2.81 11.86 2 13.5 2 15.98 2 18 4.02 18 6.5c0 2.78-2.18 4.86-5.91 6.86L8 14z"
          />
        </svg>
      }
      @case ('eye') {
        <svg
          [attr.viewBox]="viewBox()"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          [attr.width]="px()"
          [attr.height]="px()"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      }
    }
  `,
})
export class IconComponent {
  /** Which icon to draw. */
  readonly name = input.required<IconName>();

  /** Rendered box in pixels. Defaults to the icon's natural size. */
  readonly size = input(0);

  /** Outline icons can be drawn filled too (the heart toggle relies on this). */
  readonly filled = input(true);

  protected readonly naturalSize = () => NATURAL[this.name()] ?? 24;

  /** Icons drawn on a 16px grid would blur at 24px, so the grid follows the icon. */
  protected readonly viewBox = () => (NATURAL[this.name()] === 16 ? '0 0 16 16' : '0 0 24 24');

  protected readonly px = () => this.size() || this.naturalSize();

  protected readonly paint = () => (FILLED.has(this.name()) ? 'currentColor' : 'none');
}
