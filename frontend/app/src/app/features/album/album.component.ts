import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ArtistLookupService } from '../../core/services/artist-lookup.service';
import { BackNavigationService } from '../../core/services/back-navigation.service';
import { type PlayerTrack } from '../../core/services/player.service';
import { ThumbComponent } from '../../shared/components/thumb/thumb.component';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import type { AlbumDetailDto } from '../search/search.model';
import { AppTrack } from '../../shared/models/track.model';
import { formatDurationCompact, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { toPlayerTracks } from '../../shared/utils/player-track.util';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, TranslatePipe, ThumbComponent, SkeletonComponent],
  template: `
    <div class="page">
      @if (error()) {
        <p class="error-text">{{ error() }}</p>
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
      } @else if (loading()) {
        <app-skeleton variant="lg" />
        <div class="skel-list">
          <app-skeleton [count]="5" />
        </div>
      } @else if (detail(); as d) {
        <div class="head">
          <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
          <div class="hero">
            <app-thumb class="cover" [src]="d.thumbnailUrl" [alt]="d.title" [size]="120" />
            <div class="meta">
              <h1>{{ d.title }}</h1>
              <button
                type="button"
                class="sub sub-link tap"
                (click)="artistLookup.openArtist(d.artist)"
                [attr.aria-label]="'Открыть исполнителя ' + d.artist"
              >
                {{ d.artist }}
              </button>
              @if (d.year) {
                <p class="year">{{ d.year }}</p>
              }
            </div>
          </div>
          <div class="meta-row">
            <span class="meta-pill">{{ trackCountLabel() }}</span>
            <span class="meta-sep">·</span>
            <span class="meta-pill">{{ totalDurationLabel() }}</span>
          </div>
        </div>

        <div class="list">
          @for (t of d.tracks; track t.trackId) {
            <app-track-card [track]="toAppTrack(t)" [showDuration]="true" [queue]="queueTracks()" />
          }
        </div>
      }
    </div>
  `,
  styleUrl: './album.component.css',
})
export class AlbumComponent {
  private static readonly LAST_ALBUM_KEY = 'last.album.browseId';
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly detailCache = new Map<string, AlbumDetailDto>();
  readonly api = inject(ApiService);
  private readonly settings = inject(AppSettingsService);
  readonly artistLookup = inject(ArtistLookupService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<AlbumDetailDto | null>(null);
  readonly queueTracks = computed<PlayerTrack[]>(() => toPlayerTracks(this.detail()?.tracks ?? []));
  readonly trackCountLabel = computed(
    () => `${this.queueTracks().length} ${this.settings.t('tracksSuffix')}`,
  );
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.queueTracks().reduce(
      (sum, track) => sum + (normalizeDurationSeconds(track.duration) ?? 0),
      0,
    );
    return formatDurationCompact(totalSec);
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('browseId');
    if (!id?.trim()) {
      this.loading.set(false);
      this.error.set(this.settings.t('invalidLink'));
      return;
    }
    const albumId = id.trim();
    sessionStorage.setItem(AlbumComponent.LAST_ALBUM_KEY, albumId);
    sessionStorage.setItem(AlbumComponent.LAST_VIEW_KEY, 'album');
    const cached = AlbumComponent.detailCache.get(albumId);
    if (cached) {
      this.detail.set(cached);
      this.loading.set(false);
      return;
    }
    const enc = encodeURIComponent(albumId);
    this.api.get<AlbumDetailDto>(`albums/${enc}`).subscribe({
      next: (d) => {
        AlbumComponent.detailCache.set(albumId, d);
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.settings.t('failedLoadAlbum'));
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.backNavigation.back('/');
  }

  toAppTrack(t: AlbumDetailDto['tracks'][number]): AppTrack {
    return {
      trackId: t.trackId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl || null,
      duration: t.duration ?? null,
    };
  }
}
