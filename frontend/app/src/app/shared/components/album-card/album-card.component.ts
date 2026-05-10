import { CommonModule } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArtistLookupService } from '../../../core/services/artist-lookup.service';
import type { YtmAlbumCard } from '../../../features/search/search.model';
import { TranslatePipe } from '../../pipes/t.pipe';

@Component({
  selector: 'app-album-card',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <a
      class="row-card row-album tap"
      [routerLink]="['/albums', album().browseId]"
      (click)="onAlbumClick()"
      [attr.aria-label]="album().title + ', ' + album().artist"
    >
      <div class="row-thumb album-cover">
        @if (album().thumbnailUrl) {
          <img [src]="album().thumbnailUrl" [alt]="album().title" width="48" height="48" />
        } @else {
          <div class="thumb-ph" aria-hidden="true"></div>
        }
      </div>
      <div class="row-info">
        <div class="row-title">{{ album().title }}</div>
        <div class="row-sub">
          <button
            type="button"
            class="row-artist row-artist-link tap"
            (click)="onArtistClick($event, album().artist)"
            [attr.aria-label]="'Открыть исполнителя ' + album().artist"
          >
            {{ album().artist }}
          </button>
          @if (album().year) {
            <span class="row-sep" aria-hidden="true">·</span>
            <span class="row-year">{{ album().year }}</span>
          }
        </div>
      </div>
      <span class="row-badge">{{ 'albumBadge' | t }}</span>
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
    .row-thumb.album-cover {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .row-thumb.album-cover img {
      width: 48px;
      height: 48px;
      object-fit: cover;
      display: block;
    }
    .thumb-ph {
      width: 48px;
      height: 48px;
      background: var(--border);
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
    .row-artist {
      display: inline;
      background: transparent;
      border: 0;
      padding: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .row-artist-link:hover {
      text-decoration: underline;
      color: var(--accent);
    }
    .row-sep {
      opacity: 0.55;
      margin: 0 4px;
    }
    .row-year {
      font-variant-numeric: tabular-nums;
      color: var(--accent-dim);
    }
    .row-badge {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--accent-dim);
      padding: 4px 8px;
      border-radius: 6px;
      background: var(--bg-hover);
      border: 1px solid var(--border);
    }
    .tap:active {
      transform: scale(0.992);
    }
  `,
})
export class AlbumCardComponent {
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly LAST_ARTIST_KEY = 'last.artist.browseId';
  private static readonly ALBUM_BACK_TO_ARTIST_KEY = 'album.backToArtist.browseId';

  readonly album = input.required<YtmAlbumCard>();

  private readonly artistLookup = inject(ArtistLookupService);
  private readonly router = inject(Router);

  onAlbumClick(): void {
    // If we're currently on an artist page, remember it as album "back" target.
    // This fixes: search -> artist -> album -> back should return to artist (not search).
    const lastView = (sessionStorage.getItem(AlbumCardComponent.LAST_VIEW_KEY) ?? '').trim();
    if (lastView !== 'artist') {
      return;
    }
    const artistId = (sessionStorage.getItem(AlbumCardComponent.LAST_ARTIST_KEY) ?? '').trim();
    if (!artistId) {
      return;
    }
    sessionStorage.setItem(AlbumCardComponent.ALBUM_BACK_TO_ARTIST_KEY, artistId);
  }

  onArtistClick(ev: MouseEvent, artistName: string): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.openArtist(artistName);
  }

  private openArtist(artistName: string): void {
    const name = artistName.trim();
    if (!name) {
      return;
    }
    this.artistLookup.resolveBrowseIdByName(name).subscribe((browseId) => {
      if (!browseId) {
        return;
      }
      void this.router.navigate(['/artists', browseId]);
    });
  }
}
