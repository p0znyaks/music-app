import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ArtistLookupService } from '../../core/services/artist-lookup.service';
import { BackNavigationService } from '../../core/services/back-navigation.service';
import { type PlayerTrack } from '../../core/services/player.service';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import type { AlbumDetailDto } from '../search/search.model';
import { AppTrack } from '../../shared/models/track.model';
import { formatDurationCompact, normalizeDurationSeconds } from '../../shared/utils/duration.util';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule, TrackCardComponent, TranslatePipe],
  template: `
    <div class="page">
      @if (error()) {
        <p class="err">{{ error() }}</p>
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
      } @else if (loading()) {
        <div class="skel skel-lg"></div>
        <div class="skel-list">
          @for (i of [0, 1, 2, 3, 4]; track i) {
            <div class="skel skel-row"></div>
          }
        </div>
      } @else if (detail(); as d) {
        <div class="head">
          <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
          <div class="hero">
            @if (d.thumbnailUrl) {
              <img class="cover" [src]="d.thumbnailUrl" [alt]="d.title" width="120" height="120" />
            } @else {
              <div class="cover-ph" aria-hidden="true"></div>
            }
            <div class="meta">
              <h1>{{ d.title }}</h1>
              <button
                type="button"
                class="sub sub-link tap"
                (click)="openArtist(d.artist)"
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
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
    }
    .head {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .hero {
      display: flex;
      gap: 1.25rem;
      align-items: flex-start;
    }
    .cover {
      width: 120px;
      height: 120px;
      border-radius: 10px;
      object-fit: cover;
      flex-shrink: 0;
    }
    .cover-ph {
      width: 120px;
      height: 120px;
      border-radius: 10px;
      background: #2a2a2a;
      flex-shrink: 0;
    }
    .meta {
      min-width: 0;
      flex: 1;
    }
    h1 {
      font-size: 1.35rem;
      margin: 0 0 0.35rem;
      line-height: 1.25;
    }
    .sub {
      margin: 0;
      color: var(--accent-dim);
      font-size: 0.95rem;
    }
    .sub-link {
      background: transparent;
      border: 0;
      padding: 0;
      text-align: left;
      cursor: pointer;
      width: fit-content;
    }
    .sub-link:hover {
      text-decoration: underline;
      color: var(--accent);
    }
    .year {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: #808080;
    }
    .back {
      margin: 0;
      align-self: flex-start;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent-dim);
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .meta-pill {
      font-size: 0.86rem;
      color: var(--accent-dim);
    }
    .meta-sep {
      color: var(--accent-dim);
      opacity: 0.7;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .err {
      color: #c44;
      margin-bottom: 1rem;
    }
    .skel {
      border-radius: 10px;
      background: var(--bg-card);
      animation: pulse 1.2s ease-in-out infinite;
    }
    .skel-lg {
      height: 140px;
      max-width: 400px;
    }
    .skel-list {
      margin-top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .skel-row {
      height: 64px;
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 0.55;
      }
      50% {
        opacity: 0.9;
      }
    }
  `,
})
export class AlbumComponent {
  private static readonly LAST_ALBUM_KEY = 'last.album.browseId';
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly detailCache = new Map<string, AlbumDetailDto>();
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);
  private readonly artistLookup = inject(ArtistLookupService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<AlbumDetailDto | null>(null);
  readonly queueTracks = computed<PlayerTrack[]>(() => this.detail()?.tracks.map((t) => this.toPlayerTrack(t)) ?? []);
  readonly trackCountLabel = computed(() => `${this.queueTracks().length} ${this.settings.t('tracksSuffix')}`);
  readonly totalDurationLabel = computed(() => {
    const totalSec = this.queueTracks().reduce((sum, track) => sum + (normalizeDurationSeconds(track.duration) ?? 0), 0);
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

  private toPlayerTrack(t: AlbumDetailDto['tracks'][number]): PlayerTrack {
    return {
      trackId: t.trackId,
      title: t.title,
      artist: t.artist,
      thumbnailUrl: t.thumbnailUrl || undefined,
      duration: t.duration ?? undefined,
    };
  }

  openArtist(artistName: string): void {
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
