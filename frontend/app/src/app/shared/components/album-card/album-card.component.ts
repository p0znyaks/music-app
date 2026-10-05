import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArtistLookupService } from '../../../core/services/artist-lookup.service';
import type { YtmAlbumCard } from '../../../features/search/search.model';
import { TranslatePipe } from '../../pipes/t.pipe';
import { ThumbComponent } from '../thumb/thumb.component';

@Component({
  selector: 'app-album-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, TranslatePipe, ThumbComponent],
  template: `
    <a
      class="row-card tap"
      [routerLink]="['/albums', album().browseId]"
      (click)="onAlbumClick()"
      [attr.aria-label]="album().title + ', ' + album().artist"
    >
      <div class="row-thumb album-cover">
        <app-thumb [src]="album().thumbnailUrl" [alt]="album().title" [size]="48" />
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
  styleUrl: './album-card.component.css',
})
export class AlbumCardComponent {
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly LAST_ARTIST_KEY = 'last.artist.browseId';
  private static readonly ALBUM_BACK_TO_ARTIST_KEY = 'album.backToArtist.browseId';

  readonly album = input.required<YtmAlbumCard>();

  private readonly artistLookup = inject(ArtistLookupService);

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
    this.artistLookup.openArtist(artistName);
  }
}
