import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder shown while a list or block is loading.
 *
 * Replaces six differently-named skeleton classes (`skel-row`, `skel-hero`,
 * `skel-list`, `skel-lg`, plus bare `.skeleton` and `.skeleton--subtle`).
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'skeleton-host' },
  template: `
    <div [class]="'skeleton ' + variant()" [style.height.px]="height()"></div>
    @if (count() > 1) {
      @for (i of rest(); track i) {
        <div [class]="'skeleton ' + variant()" [style.height.px]="height()"></div>
      }
    }
  `,
})
export class SkeletonComponent {
  /** Shape to draw. */
  readonly variant = input<'row' | 'hero' | 'lg' | 'block'>('row');

  /** How many bars to render. */
  readonly count = input(1);

  /** Explicit height; falls back to the variant's own styling. */
  readonly height = input(0);

  /** `count` minus the first bar, so the template stays O(1) in the class. */
  protected readonly rest = (): number[] => {
    const n = this.count() - 1;
    return n > 0 ? Array.from({ length: n }, (_, i) => i) : [];
  };
}
