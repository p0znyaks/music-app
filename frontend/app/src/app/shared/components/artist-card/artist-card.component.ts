import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { YtmArtistCard } from '../../../features/search/search.model';

@Component({
  selector: 'app-artist-card',
  standalone: true,
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
  styles: `
    :host {
      display: block;
    }
    a.row-card {
      text-decoration: none;
      color: inherit;
    }
    .row-card {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 0 12px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      border-radius: 10px;
      transition: background 0.2s ease;
    }
    .row-card:hover {
      background: var(--bg-hover);
    }
    .row-thumb {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      overflow: hidden;
    }
    .row-thumb-round {
      border-radius: 50%;
    }
    .row-thumb-round img {
      display: block;
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 50%;
    }
    .row-artist-avatar {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--accent-dim);
    }
    .row-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
      justify-content: center;
    }
    .row-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--accent);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-sub {
      font-size: 12px;
      color: var(--accent-dim);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tap:active {
      transform: scale(0.992);
    }
  `,
})
export class ArtistCardComponent {
  readonly artist = input.required<YtmArtistCard>();
}
