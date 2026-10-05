import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { BackNavigationService } from '../../core/services/back-navigation.service';
import { AlbumCardComponent } from '../../shared/components/album-card/album-card.component';
import type { ArtistDetailDto, YtmAlbumCard } from '../search/search.model';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-artist',
  standalone: true,
  imports: [
    CommonModule,
    AlbumCardComponent,
    TranslatePipe,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="page">
      @if (error()) {
        <p class="error-text">{{ error() }}</p>
        <button type="button" class="back tap" (click)="back()">← {{ 'back' | t }}</button>
      } @else if (loading()) {
        <app-skeleton variant="hero" />
        <div class="skel-list">
          <app-skeleton [count]="4" />
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
          <app-empty-state titleKey="noAlbumsFound" />
        }
      }
    </div>
  `,
  styleUrl: './artist.component.css',
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
