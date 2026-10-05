import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { YtmArtistCard } from '../../../features/search/search.model';

@Component({
  selector: 'app-artist-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      class="row-card row-artist tap"
      [routerLink]="['/artists', artist().browseId]"
      [attr.aria-label]="artist().name"
    >
      @if (artist().thumbnailUrl) {
        <div class="row-thumb row-thumb-round">
          <img [src]="artist().thumbnailUrl!" [alt]="artist().name" width="48" height="48" />
        </div>
      } @else {
        <div class="row-artist-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
            <path
              d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
            />
          </svg>
        </div>
      }
      <div class="row-info">
        <div class="row-title">{{ artist().name }}</div>
        @if (artist().subscribers) {
          <div class="row-sub">{{ artist().subscribers }} Monthly Listeners</div>
        }
      </div>
    </a>
  `,
  styleUrl: './artist-card.component.css',
})
export class ArtistCardComponent {
  readonly artist = input.required<YtmArtistCard>();
}
