import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { PlayerService, type PlayerTrack } from '../../core/services/player.service';
import type { AppTrack } from '../../shared/models/track.model';
import type { HomeRecoResponse } from './home.model';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M21 21l-4.35-4.35" stroke-linecap="round"></path>
        </svg>
        <input
          type="text"
          [(ngModel)]="query"
          [placeholder]="'searchPlaceholder' | t"
          (keydown.enter)="openSearch()"
        />
      </div>

      @if (loading()) {
        <div class="skel skel-header"></div>
        <div class="skel skel-row"></div>
        <div class="skel skel-row"></div>
      } @else if (error()) {
        <div class="error">{{ error() }}</div>
      } @else if (data(); as d) {
        <section class="section">
          <div class="section-head">
            <h2>{{ 'homeRecommended' | t }}</h2>
            <div class="nav-btns">
              <button type="button" class="nav-btn" (click)="prev('recommended')" [disabled]="!canPrev('recommended')" aria-label="Назад">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14.5 6.5L9 12l5.5 5.5" />
                </svg>
              </button>
              <button type="button" class="nav-btn" (click)="next('recommended', d.recommendedTracks.length)" [disabled]="!canNext('recommended', d.recommendedTracks.length)" aria-label="Вперёд">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9.5 6.5L15 12l-5.5 5.5" />
                </svg>
              </button>
            </div>
          </div>
          <div
            class="track-grid"
            [class.slide-next]="animDirection('recommended') === 'next'"
            [class.slide-prev]="animDirection('recommended') === 'prev'"
          >
            @for (track of pageSlice(d.recommendedTracks, 'recommended'); track track.trackId) {
              <button type="button" class="track-row" (click)="playTrack(track, d.recommendedTracks)">
                <div class="thumb-wrap">
                  @if (track.thumbnailUrl) {
                    <img [src]="track.thumbnailUrl" [alt]="track.title" width="48" height="48" />
                  } @else {
                    <div class="thumb-ph"></div>
                  }
                </div>
                <span class="track-info">
                  <span class="title">{{ track.title }}</span>
                  <span class="sub">{{ track.artist }}</span>
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
                <img class="tile-cover" [src]="album.thumbnailUrl" [alt]="album.title" width="168" height="168" />
                <div class="tile-title">{{ album.title }}</div>
                <div class="tile-sub">{{ album.artist }}</div>
              </a>
            }
          </div>
        </section>

        <section class="section">
          <div class="section-head">
            <h2>{{ 'homeMixesForYou' | t }}</h2>
          </div>
          <div class="tile-grid static-eight">
            @for (mix of d.mixesForYou.slice(0, 8); track mix.id) {
              <a class="tile mix-tile" [routerLink]="['/mixes', mix.id]" [state]="{ name: mix.title }">
                @if (mix.previewThumbs?.length) {
                  <div class="mix-collage tile-cover" aria-hidden="true">
                    @for (thumb of (mix.previewThumbs ?? []).slice(0, 4); track thumb) {
                      <img [src]="thumb" [alt]="mix.title" />
                    }
                  </div>
                } @else if (mix.thumbnailUrl) {
                  <img class="tile-cover" [src]="mix.thumbnailUrl" [alt]="mix.title" width="168" height="168" />
                } @else {
                  <div class="tile-cover ph"></div>
                }
                <div class="tile-title">{{ mix.title }}</div>
                <div class="tile-sub">{{ mix.subtitle }}</div>
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
                  <img class="tile-cover round" [src]="artist.thumbnailUrl" [alt]="artist.name" width="168" height="168" />
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
                <button type="button" class="nav-btn" (click)="prev('genre-' + block.genre)" [disabled]="!canPrev('genre-' + block.genre)" aria-label="Назад">
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14.5 6.5L9 12l5.5 5.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="nav-btn"
                  (click)="next('genre-' + block.genre, block.tracks.length)"
                  [disabled]="!canNext('genre-' + block.genre, block.tracks.length)"
                  aria-label="Вперёд"
                >
                  <svg class="nav-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9.5 6.5L15 12l-5.5 5.5" />
                  </svg>
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
                    @if (track.thumbnailUrl) {
                      <img [src]="track.thumbnailUrl" [alt]="track.title" width="48" height="48" />
                    } @else {
                      <div class="thumb-ph"></div>
                    }
                  </div>
                  <span class="track-info">
                    <span class="title">{{ track.title }}</span>
                    <span class="sub">{{ track.artist }}</span>
                  </span>
                </button>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 560px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--bg-card);
      padding: 10px 14px;
    }
    .search-box svg {
      width: 20px;
      height: 20px;
      color: var(--accent-dim);
      flex-shrink: 0;
    }
    .search-box input {
      width: 100%;
      border: none;
      outline: none;
      background: transparent;
      color: var(--accent);
    }
    .section {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 {
      font-size: 2rem;
      line-height: 1.1;
    }
    .nav-btns {
      display: flex;
      gap: 8px;
    }
    .nav-btn {
      width: 42px;
      height: 42px;
      padding: 0;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease;
    }
    .nav-icon {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2.7;
      stroke-linecap: round;
      stroke-linejoin: round;
      display: block;
    }
    .nav-btn:hover:not(:disabled) {
      transform: translateY(-1px) scale(1.06);
      background: var(--bg-hover);
      border-color: var(--accent-dim);
      color: var(--accent);
      box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
    }
    .nav-btn:active:not(:disabled) {
      transform: scale(0.96);
    }
    .nav-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .tile-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
      gap: 14px;
    }
    .tile-grid.static-eight {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
    .tile {
      display: block;
      text-decoration: none;
      color: inherit;
    }
    .tile-cover {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 12px;
      object-fit: cover;
      border: 1px solid var(--border);
      background: var(--bg-card);
    }
    .tile-cover.round {
      border-radius: 50%;
    }
    .tile-cover.ph {
      background: linear-gradient(145deg, var(--border), var(--bg-hover));
    }
    .tile-title {
      margin-top: 8px;
      font-weight: 600;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tile-sub,
    .mix-artists {
      color: var(--accent-dim);
      font-size: 0.82rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mix-tile .mix-artists {
      margin-top: 2px;
    }
    .mix-collage {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
      overflow: hidden;
    }
    .mix-collage img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .track-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px 14px;
      transition: transform 0.25s ease, opacity 0.25s ease;
      will-change: transform, opacity;
    }
    .track-grid.slide-next {
      animation: slide-next 0.26s ease;
    }
    .track-grid.slide-prev {
      animation: slide-prev 0.26s ease;
    }
    .track-row {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 58px;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--bg-card);
      color: inherit;
      cursor: pointer;
      text-align: left;
    }
    .track-row:hover {
      background: var(--bg-hover);
    }
    .thumb-wrap img,
    .thumb-ph {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      object-fit: cover;
      background: var(--border);
      flex-shrink: 0;
    }
    .track-info {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title,
    .sub {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .title {
      font-size: 0.9rem;
      color: var(--accent);
    }
    .sub {
      font-size: 0.8rem;
      color: var(--accent-dim);
    }
    .error {
      color: #c44;
    }
    .skel {
      border-radius: 10px;
      background: var(--bg-hover);
      animation: pulse 1.2s ease-in-out infinite;
    }
    .skel-header {
      height: 46px;
      max-width: 560px;
    }
    .skel-row {
      height: 180px;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.95; }
    }
    @keyframes slide-next {
      0% {
        opacity: 0.6;
        transform: translateX(14px);
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @keyframes slide-prev {
      0% {
        opacity: 0.6;
        transform: translateX(-14px);
      }
      100% {
        opacity: 1;
        transform: translateX(0);
      }
    }
    @media (max-width: 1280px) {
      .tile-grid.static-eight {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .track-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 860px) {
      .tile-grid.static-eight {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .track-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
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

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<HomeRecoResponse>('reco/home').subscribe({
      next: (payload) => {
        this.data.set(this.normalizeHomePayload(payload));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.settings.t('failedLoadHome'));
        this.loading.set(false);
      },
    });
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
      duration: row.duration ?? undefined,
    }));
    const current: PlayerTrack = {
      trackId: track.trackId,
      title: track.title,
      artist: track.artist,
      thumbnailUrl: track.thumbnailUrl ?? undefined,
      duration: track.duration ?? undefined,
    };
    this.player.setQueue(normalizedQueue);
    this.player.play(current);
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
