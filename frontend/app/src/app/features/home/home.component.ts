import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { ThumbComponent } from '../../shared/components/thumb/thumb.component';
import type { AppTrack } from '../../shared/models/track.model';
import type { HomeRecoResponse } from './home.model';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { formatDurationClock, normalizeDurationSeconds } from '../../shared/utils/duration.util';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    ThumbComponent,
    IconComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="page">
      <div class="search-box">
        <app-icon name="search" />
        <input
          type="text"
          [(ngModel)]="query"
          [placeholder]="'searchPlaceholder' | t"
          (keydown.enter)="openSearch()"
        />
      </div>

      @if (loading()) {
        <app-skeleton variant="block" [height]="28" />
        <app-skeleton [count]="2" />
      } @else if (error()) {
        <div class="error-text">{{ error() }}</div>
      } @else if (data(); as d) {
        <section class="section">
          <div class="section-head">
            <h2>{{ 'homeRecommended' | t }}</h2>
            <div class="nav-btns">
              <button
                type="button"
                class="nav-btn"
                (click)="prev('recommended')"
                [disabled]="!canPrev('recommended')"
                aria-label="Назад"
              >
                <app-icon class="nav-icon" name="chevron-left" />
              </button>
              <button
                type="button"
                class="nav-btn"
                (click)="next('recommended', d.recommendedTracks.length)"
                [disabled]="!canNext('recommended', d.recommendedTracks.length)"
                aria-label="Вперёд"
              >
                <app-icon class="nav-icon" name="chevron-right" />
              </button>
            </div>
          </div>
          <div
            class="track-grid"
            [class.slide-next]="animDirection('recommended') === 'next'"
            [class.slide-prev]="animDirection('recommended') === 'prev'"
          >
            @for (track of pageSlice(d.recommendedTracks, 'recommended'); track track.trackId) {
              <button
                type="button"
                class="track-row"
                (click)="playTrack(track, d.recommendedTracks)"
              >
                <div class="thumb-wrap">
                  <app-thumb [src]="track.thumbnailUrl" [alt]="track.title" [size]="48" />
                </div>
                <span class="track-info">
                  <span class="title">{{ track.title }}</span>
                  <span class="sub-row">
                    <span class="sub">{{ track.artist }}</span>
                    @if (formatDuration(track)) {
                      <span class="dur">{{ formatDuration(track) }}</span>
                    }
                  </span>
                </span>
              </button>
            }
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h2>{{ 'homeAlbumsForYou' | t }}</h2>
          </div>
          <div class="tile-grid static-eight">
            @for (album of d.albumsForYou.slice(0, 8); track album.browseId) {
              <a class="tile" [routerLink]="['/albums', album.browseId]">
                <img
                  class="tile-cover"
                  [src]="album.thumbnailUrl"
                  [alt]="album.title"
                  width="168"
                  height="168"
                />
                <div class="tile-title">{{ album.title }}</div>
                <div class="tile-sub">{{ album.artist }}</div>
              </a>
            }
          </div>
        </section>

        @for (block of d.similarTo; track block.seedArtist) {
          <section class="section">
            <div class="section-head">
              <h2>{{ 'similarTo' | t }}: {{ block.seedArtist }}</h2>
            </div>
            <div class="tile-grid static-eight">
              @for (artist of block.items.slice(0, 8); track artist.browseId) {
                <a class="tile" [routerLink]="['/artists', artist.browseId]">
                  <img
                    class="tile-cover round"
                    [src]="artist.thumbnailUrl"
                    [alt]="artist.name"
                    width="168"
                    height="168"
                  />
                  <div class="tile-title">{{ artist.name }}</div>
                </a>
              }
            </div>
          </section>
        }

        @for (block of d.byGenre; track block.genre) {
          <section class="section">
            <div class="section-head">
              <h2>{{ block.genre | titlecase }}</h2>
              <div class="nav-btns">
                <button
                  type="button"
                  class="nav-btn"
                  (click)="prev('genre-' + block.genre)"
                  [disabled]="!canPrev('genre-' + block.genre)"
                  aria-label="Назад"
                >
                  <app-icon class="nav-icon" name="chevron-left" />
                </button>
                <button
                  type="button"
                  class="nav-btn"
                  (click)="next('genre-' + block.genre, block.tracks.length)"
                  [disabled]="!canNext('genre-' + block.genre, block.tracks.length)"
                  aria-label="Вперёд"
                >
                  <app-icon class="nav-icon" name="chevron-right" />
                </button>
              </div>
            </div>
            <div
              class="track-grid"
              [class.slide-next]="animDirection('genre-' + block.genre) === 'next'"
              [class.slide-prev]="animDirection('genre-' + block.genre) === 'prev'"
            >
              @for (track of pageSlice(block.tracks, 'genre-' + block.genre); track track.trackId) {
                <button type="button" class="track-row" (click)="playTrack(track, block.tracks)">
                  <div class="thumb-wrap">
                    <app-thumb [src]="track.thumbnailUrl" [alt]="track.title" [size]="48" />
                  </div>
                  <span class="track-info">
                    <span class="title">{{ track.title }}</span>
                    <span class="sub-row">
                      <span class="sub">{{ track.artist }}</span>
                      @if (formatDuration(track)) {
                        <span class="dur">{{ formatDuration(track) }}</span>
                      }
                    </span>
                  </span>
                </button>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly player = inject(PlayerService);
  private readonly settings = inject(AppSettingsService);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly data = signal<HomeRecoResponse | null>(null);
  query = '';
  private readonly sectionPage = signal<Record<string, number>>({});
  private readonly pageSize = computed(() => this.data()?.carousel.pageSize ?? 6);
  private readonly maxForwardPages = computed(() => this.data()?.carousel.maxForwardPages ?? 2);
  private readonly sectionAnim = signal<Record<string, 'next' | 'prev' | null>>({});
  private readonly CACHE_KEY = 'home_data_cache';
  private readonly CACHE_MAX_AGE = 60 * 60 * 1000;

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    const cached = this.loadCachedHomeData();
    if (cached) {
      this.data.set(cached);
      this.loading.set(false);
    }

    this.api.get<HomeRecoResponse>('reco/home').subscribe({
      next: (payload) => {
        try {
          const normalized = this.normalizeHomePayload(payload);
          this.data.set(normalized);
          this.saveCachedHomeData(normalized);
        } catch {
          // A malformed payload must not strand the spinner: keep whatever is
          // on screen (or the local cache) and just stop loading.
          if (!this.data()) {
            this.error.set(this.settings.t('failedLoadHome'));
          }
        }
        this.loading.set(false);
      },
      error: () => {
        if (!this.data()) {
          this.error.set(this.settings.t('failedLoadHome'));
        }
        this.loading.set(false);
      },
    });
  }

  private loadCachedHomeData(): HomeRecoResponse | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { data: HomeRecoResponse; savedAt: number };
      if (Date.now() - parsed.savedAt > this.CACHE_MAX_AGE) {
        localStorage.removeItem(this.CACHE_KEY);
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  private saveCachedHomeData(data: HomeRecoResponse): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {
      /* storage unavailable or full — ignore */
    }
  }

  openSearch(): void {
    const value = this.query.trim();
    if (!value) {
      return;
    }
    void this.router.navigate(['/search'], { queryParams: { q: value } });
  }

  pageSlice<T>(items: T[], key: string): T[] {
    const size = this.pageSize();
    const page = this.sectionPage()[key] ?? 0;
    return items.slice(page * size, page * size + size);
  }

  canPrev(key: string): boolean {
    return (this.sectionPage()[key] ?? 0) > 0;
  }

  canNext(key: string, totalItems: number): boolean {
    const size = this.pageSize();
    const page = this.sectionPage()[key] ?? 0;
    const maxPageByItems = Math.max(Math.ceil(totalItems / size) - 1, 0);
    const maxPage = Math.min(maxPageByItems, this.maxForwardPages());
    return page < maxPage;
  }

  prev(key: string): void {
    this.markAnim(key, 'prev');
    this.sectionPage.update((state) => {
      const current = state[key] ?? 0;
      return { ...state, [key]: Math.max(0, current - 1) };
    });
  }

  next(key: string, totalItems: number): void {
    this.markAnim(key, 'next');
    const size = this.pageSize();
    const maxPageByItems = Math.max(Math.ceil(totalItems / size) - 1, 0);
    const maxPage = Math.min(maxPageByItems, this.maxForwardPages());
    this.sectionPage.update((state) => {
      const current = state[key] ?? 0;
      return { ...state, [key]: Math.min(maxPage, current + 1) };
    });
  }

  animDirection(key: string): 'next' | 'prev' | null {
    return this.sectionAnim()[key] ?? null;
  }

  private markAnim(key: string, dir: 'next' | 'prev'): void {
    this.sectionAnim.update((state) => ({ ...state, [key]: dir }));
    setTimeout(() => {
      this.sectionAnim.update((state) => {
        if (state[key] !== dir) {
          return state;
        }
        const nextState = { ...state };
        delete nextState[key];
        return nextState;
      });
    }, 280);
  }

  playTrack(track: AppTrack, queue: AppTrack[]): void {
    const normalizedQueue: PlayerTrack[] = queue.map((row) => ({
      trackId: row.trackId,
      title: row.title,
      artist: row.artist,
      thumbnailUrl: row.thumbnailUrl ?? undefined,
      duration: typeof row.duration === 'number' ? row.duration : undefined,
    }));
    const current: PlayerTrack = {
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      thumbnailUrl: track.thumbnailUrl ?? undefined,
      duration: typeof track.duration === 'number' ? track.duration : undefined,
    };
    this.player.setQueue(normalizedQueue);
    this.player.play(current);
  }

  formatDuration(track: AppTrack): string {
    const sec = normalizeDurationSeconds(track.duration);
    if (sec == null) return '';
    return formatDurationClock(sec);
  }

  private normalizeHomePayload(payload: HomeRecoResponse): HomeRecoResponse {
    const normalizeTrack = (row: AppTrack): AppTrack => ({
      ...row,
      thumbnailUrl: this.normalizeImageUrl(row.thumbnailUrl),
    });
    return {
      ...payload,
      recommendedTracks: payload.recommendedTracks.map(normalizeTrack),
      albumsForYou: payload.albumsForYou.map((row) => ({
        ...row,
        thumbnailUrl: this.normalizeImageUrl(row.thumbnailUrl) ?? row.thumbnailUrl,
      })),
      mixesForYou: payload.mixesForYou.map((mix) => ({
        ...mix,
        thumbnailUrl: this.normalizeImageUrl(mix.thumbnailUrl),
        previewThumbs: (mix.previewThumbs ?? [])
          .map((url) => this.normalizeImageUrl(url))
          .filter((url): url is string => !!url),
      })),
      similarTo: payload.similarTo.map((block) => ({
        ...block,
        items: block.items.map((item) => ({
          ...item,
          thumbnailUrl: this.normalizeImageUrl(item.thumbnailUrl) ?? item.thumbnailUrl,
        })),
      })),
      byGenre: payload.byGenre.map((block) => ({
        ...block,
        tracks: block.tracks.map(normalizeTrack),
      })),
    };
  }

  private normalizeImageUrl(url: string | null | undefined): string | null {
    if (typeof url !== 'string') {
      return null;
    }
    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }
    if (trimmed.startsWith('http://')) {
      return `https://${trimmed.slice('http://'.length)}`;
    }
    return trimmed;
  }
}
