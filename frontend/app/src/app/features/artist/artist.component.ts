import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { BackNavigationService } from '../../core/services/back-navigation.service';
import { AlbumCardComponent } from '../../shared/components/album-card/album-card.component';
import type { ArtistDetailDto, YtmAlbumCard } from '../search/search.model';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-artist',
  standalone: true,
  imports: [CommonModule, AlbumCardComponent, TranslatePipe],
  template: `
    <div class="page">
      @if (error()) {
        <p class="err">{{ error() }}</p>
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
      } @else if (loading()) {
        <div class="skel skel-hero"></div>
        <div class="skel-list">
          @for (i of [0, 1, 2, 3]; track i) {
            <div class="skel skel-row"></div>
          }
        </div>
      } @else if (detail(); as d) {
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
        <div class="hero">
          @if (d.thumbnailUrl) {
            <img class="avatar" [src]="d.thumbnailUrl" [alt]="d.name" width="120" height="120" />
          } @else {
            <div class="avatar-ph" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48">
                <path
                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
                />
              </svg>
            </div>
          }
          <div class="meta">
            <h1>{{ d.name }}</h1>
            @if (d.subscribers) {
              <p class="sub">{{ d.subscribers }} {{ 'monthlyListeners' | t }}</p>
            }
          </div>
        </div>

        <h2 class="section-title">{{ 'artistAlbums' | t }}</h2>
        <div class="list">
          @for (a of albumCards(); track a.browseId) {
            <app-album-card [album]="a" />
          }
        </div>
        @if (d.albums.length === 0) {
          <p class="empty">{{ 'noAlbumsFound' | t }}</p>
        }
      }
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
    }
    .back {
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent-dim);
      padding: 0.45rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .hero {
      display: flex;
      gap: 1.25rem;
      align-items: center;
      margin-bottom: 1.75rem;
    }
    .avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .avatar-ph {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: #2a2a2a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #606060;
      flex-shrink: 0;
    }
    .meta {
      min-width: 0;
    }
    h1 {
      font-size: 1.35rem;
      margin: 0 0 0.35rem;
    }
    .sub {
      margin: 0;
      color: var(--accent-dim);
      font-size: 0.95rem;
    }
    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--accent-dim);
      margin: 0 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .empty {
      color: var(--accent-dim);
      font-size: 0.9rem;
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
    .skel-hero {
      height: 120px;
      max-width: 360px;
      border-radius: 60px;
    }
    .skel-list {
      margin-top: 1.25rem;
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
export class ArtistComponent {
  private static readonly LAST_ARTIST_KEY = 'last.artist.browseId';
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly detailCache = new Map<string, ArtistDetailDto>();
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  private readonly settings = inject(AppSettingsService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly detail = signal<ArtistDetailDto | null>(null);

  readonly albumCards = computed((): YtmAlbumCard[] => {
    const d = this.detail();
    if (!d) {
      return [];
    }
    return d.albums.map((a) => ({
      browseId: a.browseId,
      title: a.title,
      artist: d.name,
      thumbnailUrl: a.thumbnailUrl,
      year: a.year,
    }));
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('browseId');
    if (!id?.trim()) {
      this.loading.set(false);
      this.error.set(this.settings.t('invalidLink'));
      return;
    }
    const artistId = id.trim();
    sessionStorage.setItem(ArtistComponent.LAST_ARTIST_KEY, artistId);
    sessionStorage.setItem(ArtistComponent.LAST_VIEW_KEY, 'artist');
    const cached = ArtistComponent.detailCache.get(artistId);
    if (cached) {
      this.detail.set(cached);
      this.loading.set(false);
      return;
    }
    const enc = encodeURIComponent(artistId);
    this.api.get<ArtistDetailDto>(`artists/${enc}`).subscribe({
      next: (d) => {
        ArtistComponent.detailCache.set(artistId, d);
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.settings.t('failedLoadArtist'));
        this.loading.set(false);
      },
    });
  }

  back(): void {
    this.backNavigation.back('/');
  }
}
