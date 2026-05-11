import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  concat,
  type Observable,
  of,
  Subject,
  switchMap,
  tap,
} from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { AlbumCardComponent } from '../../shared/components/album-card/album-card.component';
import { ArtistCardComponent } from '../../shared/components/artist-card/artist-card.component';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import type { AppTrack } from '../../shared/models/track.model';
import type { SearchBundle, YtmAlbumCard, YtmArtistCard } from './search.model';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';

type SearchTab = 'tracks' | 'albums' | 'artists' | 'all';

type QueryPayload = {
  tracks?: AppTrack[];
  albums?: YtmAlbumCard[];
  artists?: YtmArtistCard[];
};

function sortTracksByArtistQuery(tracks: AppTrack[], rawQuery: string): AppTrack[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return [...tracks];
  }
  const isExactArtist = (t: AppTrack) => t.artist.trim().toLowerCase() === q;
  const matched = tracks.filter(isExactArtist);
  const rest = tracks.filter((t) => !isExactArtist(t));
  return [...matched, ...rest];
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, FormsModule, TrackCardComponent, AlbumCardComponent, ArtistCardComponent, TranslatePipe],
  template: `
    <div class="page">
      <div class="search-box">
        <svg class="lens" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          [(ngModel)]="inputModel"
          (ngModelChange)="onQuery($event)"
          [placeholder]="'searchPlaceholder' | t"
          class="inp"
          autocomplete="off"
        />
      </div>

      @if (hasSearched()) {
        <div class="tabs" role="tablist" [attr.aria-label]="'allTab' | t">
          @for (opt of tabOptions; track opt.id) {
            <button
              type="button"
              class="tab"
              role="tab"
              [class.active]="activeTab() === opt.id"
              [attr.aria-selected]="activeTab() === opt.id"
              (click)="setTab(opt.id)"
            >
              <span class="tab-check" aria-hidden="true">
                <svg class="check-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path class="check-path" d="M3 8.5l3.2 3.2L13 4.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="tab-text">{{ opt.label }}</span>
            </button>
          }
        </div>
      }

      @if (blockingLoading()) {
        <div class="list">
          @for (i of skeletons; track i) {
            <div class="skel"></div>
          }
        </div>
      } @else if (hasSearched()) {
        @if (isEmptyForTab()) {
          <p class="empty">{{ 'nothingFound' | t }}</p>
        } @else if (activeTab() === 'all') {
          <div class="sections">
            <section class="section">
              <h2 class="section-title">{{ 'tracksTab' | t }}</h2>
              @if (loadingTracks()) {
                <div class="list">
                  @for (i of skeletons; track i) {
                    <div class="skel"></div>
                  }
                </div>
              } @else if (visibleTracks().length > 0) {
                <div class="list">
                  @for (t of visibleTracks(); track t.trackId) {
                    <app-track-card [track]="t" [showDuration]="true" [queue]="tracksForPlayer()" />
                  }
                </div>
              }
            </section>
            <section class="section">
              <h2 class="section-title">{{ 'albumsTab' | t }}</h2>
              @if (loadingAlbums()) {
                <div class="list">
                  @for (i of skeletons; track i) {
                    <div class="skel"></div>
                  }
                </div>
              } @else if (visibleAlbums().length > 0) {
                <div class="list">
                  @for (a of visibleAlbums(); track a.browseId) {
                    <app-album-card [album]="a" />
                  }
                </div>
              }
            </section>
            <section class="section">
              <h2 class="section-title">{{ 'artistsTab' | t }}</h2>
              @if (loadingArtists()) {
                <div class="list">
                  @for (i of skeletons; track i) {
                    <div class="skel"></div>
                  }
                </div>
              } @else if (visibleArtists().length > 0) {
                <div class="list">
                  @for (ar of visibleArtists(); track ar.browseId) {
                    <app-artist-card [artist]="ar" />
                  }
                </div>
              }
            </section>
          </div>
        } @else if (activeTab() === 'tracks') {
          <div class="list">
            @for (t of visibleTracks(); track t.trackId) {
              <app-track-card [track]="t" [showDuration]="true" [queue]="tracksForPlayer()" />
            }
          </div>
        } @else if (activeTab() === 'albums') {
          <div class="list">
            @for (a of visibleAlbums(); track a.browseId) {
              <app-album-card [album]="a" />
            }
          </div>
        } @else if (activeTab() === 'artists') {
          <div class="list">
            @for (ar of visibleArtists(); track ar.browseId) {
              <app-artist-card [artist]="ar" />
            }
          </div>
        }
      }

      @if (hasSearched() && !blockingLoading() && hasMoreRows()) {
        <div #scrollSentinel class="sentinel" aria-hidden="true"></div>
      }
    </div>
  `,
  styles: `
    .page {
      padding: 0 1.5rem 2rem 2rem;
      max-width: 720px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .search-box {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.25rem;
      transition: border-color 0.2s ease;
    }
    .search-box:focus-within {
      border-color: #444;
    }
    .lens {
      width: 26px;
      height: 26px;
      color: var(--accent-dim);
      flex-shrink: 0;
    }
    .inp {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 1.25rem;
      font-weight: 500;
      outline: none;
    }
    .inp::placeholder {
      color: var(--accent-dim);
      font-weight: 400;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px 10px 12px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--bg-card);
      color: var(--accent-dim);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition:
        background 0.22s ease,
        color 0.22s ease,
        border-color 0.22s ease,
        box-shadow 0.22s ease;
    }
    .tab:hover {
      color: var(--accent);
      border-color: #3a3a3a;
      background: var(--bg-hover);
    }
    .tab.active {
      color: var(--accent);
      border-color: #4a4a4a;
      background: var(--bg-hover);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
    .tab-check {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      opacity: 0;
      transform: scale(0.45) rotate(-12deg);
      transition:
        opacity 0.24s cubic-bezier(0.34, 1.2, 0.64, 1),
        transform
          0.24s cubic-bezier(0.34, 1.2, 0.64, 1);
    }
    .tab.active .tab-check {
      opacity: 1;
      transform: scale(1) rotate(0deg);
      color: var(--accent);
    }
    .check-svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    .check-path {
      stroke-dasharray: 22;
      stroke-dashoffset: 22;
      transition: stroke-dashoffset 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
    }
    .tab.active .check-path {
      stroke-dashoffset: 0;
    }
    .tab-text {
      line-height: 1.2;
    }

    .sections {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: var(--accent-dim);
      margin: 0 0 8px;
      text-transform: uppercase;
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .skel {
      height: 72px;
      border-radius: 10px;
      background: var(--bg-card);
      animation: pulse 1.2s ease-in-out infinite;
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
    .empty {
      text-align: center;
      color: var(--accent-dim);
      padding: 4rem 1rem;
      font-size: 1rem;
    }
    .sentinel {
      height: 1px;
      width: 100%;
      margin-top: 8px;
      pointer-events: none;
    }
  `,
})
export class SearchComponent {
  private static readonly QUERY_STORAGE_KEY = 'search.query';
  private static readonly TAB_STORAGE_KEY = 'search.tab';
  private static readonly LAST_VIEW_KEY = 'last.view';
  private static readonly queryPayloadCache = new Map<string, QueryPayload>();

  private static readonly PAGE_STEP = 15;
  private static readonly INITIAL_TAB = 15;
  private static readonly INITIAL_ALL = 24;

  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly settings = inject(AppSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query$ = new Subject<string>();

  private requestGen = 0;
  private scrollObserver: IntersectionObserver | null = null;
  private sentinelCooldownUntil = 0;
  private lastRouteQuery = '';

  readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');

  readonly skeletons = [0, 1, 2, 3, 4];

  readonly tabOptions = [
    { id: 'tracks' as const, label: this.settings.t('tracksTab') },
    { id: 'albums' as const, label: this.settings.t('albumsTab') },
    { id: 'artists' as const, label: this.settings.t('artistsTab') },
    { id: 'all' as const, label: this.settings.t('allTab') },
  ];

  inputModel = '';
  readonly loadingTracks = signal(false);
  readonly loadingAlbums = signal(false);
  readonly loadingArtists = signal(false);
  readonly tracks = signal<AppTrack[]>([]);
  readonly albums = signal<YtmAlbumCard[]>([]);
  readonly artists = signal<YtmArtistCard[]>([]);
  readonly hasSearched = signal(false);
  readonly activeTab = signal<SearchTab>('tracks');
  readonly visibleLimit = signal(SearchComponent.INITIAL_TAB);

  readonly blockingLoading = computed(() => {
    if (!this.hasSearched()) {
      return false;
    }
    const tab = this.activeTab();
    if (tab === 'tracks') {
      return this.loadingTracks();
    }
    if (tab === 'albums') {
      return this.loadingAlbums();
    }
    if (tab === 'artists') {
      return this.loadingArtists();
    }
    return this.loadingTracks() && this.loadingAlbums() && this.loadingArtists();
  });

  readonly rowCapForTab = computed(() => {
    const tab = this.activeTab();
    const t = this.tracks().length;
    const a = this.albums().length;
    const r = this.artists().length;
    if (tab === 'all') {
      return Math.max(t, a, r);
    }
    if (tab === 'tracks') {
      return t;
    }
    if (tab === 'albums') {
      return a;
    }
    return r;
  });

  readonly hasMoreRows = computed(() => this.visibleLimit() < this.rowCapForTab());

  readonly lim = computed(() => this.visibleLimit());

  readonly visibleTracks = computed(() => this.tracks().slice(0, this.lim()));
  readonly visibleAlbums = computed(() => this.albums().slice(0, this.lim()));
  readonly visibleArtists = computed(() => this.artists().slice(0, this.lim()));
  readonly tracksForPlayer = computed(() =>
    this.tracks().map((track) => ({
      ...track,
      duration: track.duration ?? undefined,
      thumbnailUrl: track.thumbnailUrl ?? undefined,
      startTime: track.startTime ?? undefined,
      endTime: track.endTime ?? undefined,
    })),
  );

  readonly isEmptyForTab = computed(() => {
    if (!this.hasSearched()) {
      return false;
    }
    const tab = this.activeTab();
    if (tab === 'tracks') {
      return !this.loadingTracks() && this.tracks().length === 0;
    }
    if (tab === 'albums') {
      return !this.loadingAlbums() && this.albums().length === 0;
    }
    if (tab === 'artists') {
      return !this.loadingArtists() && this.artists().length === 0;
    }
    return (
      !this.loadingTracks() &&
      !this.loadingAlbums() &&
      !this.loadingArtists() &&
      this.tracks().length === 0 &&
      this.albums().length === 0 &&
      this.artists().length === 0
    );
  });

  constructor() {
    this.favorites.ensureLoaded();

    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        if (e.urlAfterRedirects.startsWith('/search')) {
          sessionStorage.setItem(SearchComponent.LAST_VIEW_KEY, 'search');
        }
      });

    const urlQ = (this.route.snapshot.queryParamMap.get('q') ?? '').toString();
    const storedQ = this.readStoredQuery();
    const initialQ = urlQ || storedQ;

    const urlTabRaw = (this.route.snapshot.queryParamMap.get('tab') ?? '').toString();
    const storedTab = this.readStoredTab();
    const initialTab = this.parseTab(urlTabRaw) ?? storedTab ?? 'tracks';

    this.activeTab.set(initialTab);
    this.writeStoredTab(initialTab);

    if (initialQ.trim()) {
      this.inputModel = initialQ;
      this.writeStoredQuery(initialQ);
      this.lastRouteQuery = initialQ.trim();
    }

    const queryDebounced = this.query$.pipe(
      debounceTime(150),
      map((q) => q.trim()),
      distinctUntilChanged(),
    );

    combineLatest([queryDebounced, toObservable(this.activeTab)])
      .pipe(
        switchMap(([q, tab]) => {
          const normalizedQ = q.trim();
          const minLenForStructuredSearch = tab === 'albums' || tab === 'artists' || tab === 'all' ? 2 : 1;
          if (normalizedQ.length > 0 && normalizedQ.length < minLenForStructuredSearch) {
            this.requestGen += 1;
            this.loadingTracks.set(false);
            this.loadingAlbums.set(false);
            this.loadingArtists.set(false);
            this.tracks.set([]);
            this.albums.set([]);
            this.artists.set([]);
            this.hasSearched.set(true);
            this.visibleLimit.set(SearchComponent.INITIAL_TAB);
            return of(null);
          }

          if (!q) {
            this.requestGen += 1;
            this.loadingTracks.set(false);
            this.loadingAlbums.set(false);
            this.loadingArtists.set(false);
            this.tracks.set([]);
            this.albums.set([]);
            this.artists.set([]);
            this.hasSearched.set(false);
            this.visibleLimit.set(SearchComponent.INITIAL_TAB);
            return of(null);
          }

          const gen = (this.requestGen += 1);
          this.hasSearched.set(true);
          const enc = encodeURIComponent(q);
          const cache = SearchComponent.getQueryCache(q);

          const fin = (flag: 'tracks' | 'albums' | 'artists') => () => {
            if (gen === this.requestGen) {
              if (flag === 'tracks') {
                this.loadingTracks.set(false);
              } else if (flag === 'albums') {
                this.loadingAlbums.set(false);
              } else {
                this.loadingArtists.set(false);
              }
            }
          };

          const streams: Array<Observable<unknown>> = [];

          if (tab === 'all') {
            if (cache.tracks) {
              this.tracks.set(sortTracksByArtistQuery([...cache.tracks], q));
              this.loadingTracks.set(false);
            } else {
              this.loadingTracks.set(true);
              streams.push(
                this.api.get<SearchBundle>(`search?q=${enc}`).pipe(
                  tap((bundle) => {
                    cache.tracks = sortTracksByArtistQuery(bundle.tracks, q);
                    if (gen === this.requestGen) {
                      this.tracks.set(cache.tracks!);
                    }
                  }),
                  catchError(() => {
                    cache.tracks = [];
                    if (gen === this.requestGen) {
                      this.tracks.set([]);
                    }
                    return of(null);
                  }),
                  finalize(fin('tracks')),
                ),
              );
            }

            if (cache.albums) {
              this.albums.set([...cache.albums]);
              this.loadingAlbums.set(false);
            } else {
              this.loadingAlbums.set(true);
              streams.push(
                this.api.get<YtmAlbumCard[]>(`search/albums?q=${enc}`).pipe(
                  tap((albums) => {
                    cache.albums = albums;
                    if (gen === this.requestGen) {
                      this.albums.set(albums);
                    }
                  }),
                  catchError(() => {
                    cache.albums = [];
                    if (gen === this.requestGen) {
                      this.albums.set([]);
                    }
                    return of(null);
                  }),
                  finalize(fin('albums')),
                ),
              );
            }

            if (cache.artists) {
              this.artists.set([...cache.artists]);
              this.loadingArtists.set(false);
            } else {
              this.loadingArtists.set(true);
              streams.push(
                this.api.get<YtmArtistCard[]>(`search/artists?q=${enc}`).pipe(
                  tap((artists) => {
                    cache.artists = artists;
                    if (gen === this.requestGen) {
                      this.artists.set(artists);
                    }
                  }),
                  catchError(() => {
                    cache.artists = [];
                    if (gen === this.requestGen) {
                      this.artists.set([]);
                    }
                    return of(null);
                  }),
                  finalize(fin('artists')),
                ),
              );
            }

            if (gen === this.requestGen) {
              this.visibleLimit.set(SearchComponent.INITIAL_ALL);
            }
            if (streams.length === 0) {
              return of(null);
            }
            return concat(...streams);
          }

          if (tab === 'tracks') {
            if (cache.tracks) {
              this.tracks.set(sortTracksByArtistQuery([...cache.tracks], q));
              this.loadingTracks.set(false);
              this.albums.set([]);
              this.artists.set([]);
              this.loadingAlbums.set(false);
              this.loadingArtists.set(false);
              if (gen === this.requestGen) {
                this.visibleLimit.set(SearchComponent.INITIAL_TAB);
              }
              return of(null);
            }
            this.loadingTracks.set(true);
            this.loadingAlbums.set(false);
            this.loadingArtists.set(false);
            this.albums.set([]);
            this.artists.set([]);
            return this.api.get<SearchBundle>(`search?q=${enc}`).pipe(
              tap((bundle) => {
                cache.tracks = sortTracksByArtistQuery(bundle.tracks, q);
                if (gen === this.requestGen) {
                  this.tracks.set(cache.tracks!);
                }
              }),
              catchError(() => {
                cache.tracks = [];
                if (gen === this.requestGen) {
                  this.tracks.set([]);
                }
                return of(null);
              }),
              finalize(() => {
                fin('tracks')();
                if (gen === this.requestGen) {
                  this.visibleLimit.set(SearchComponent.INITIAL_TAB);
                }
              }),
            );
          }

          if (tab === 'albums') {
            if (cache.albums) {
              this.albums.set([...cache.albums]);
              this.loadingAlbums.set(false);
              this.tracks.set([]);
              this.artists.set([]);
              this.loadingTracks.set(false);
              this.loadingArtists.set(false);
              if (gen === this.requestGen) {
                this.visibleLimit.set(SearchComponent.INITIAL_TAB);
              }
              return of(null);
            }
            this.loadingAlbums.set(true);
            this.loadingTracks.set(false);
            this.loadingArtists.set(false);
            this.tracks.set([]);
            this.artists.set([]);
            return this.api.get<YtmAlbumCard[]>(`search/albums?q=${enc}`).pipe(
              tap((albums) => {
                cache.albums = albums;
                if (gen === this.requestGen) {
                  this.albums.set(albums);
                }
              }),
              catchError(() => {
                cache.albums = [];
                if (gen === this.requestGen) {
                  this.albums.set([]);
                }
                return of(null);
              }),
              finalize(() => {
                fin('albums')();
                if (gen === this.requestGen) {
                  this.visibleLimit.set(SearchComponent.INITIAL_TAB);
                }
              }),
            );
          }

          if (cache.artists) {
            this.artists.set([...cache.artists]);
            this.loadingArtists.set(false);
            this.tracks.set([]);
            this.albums.set([]);
            this.loadingTracks.set(false);
            this.loadingAlbums.set(false);
            if (gen === this.requestGen) {
              this.visibleLimit.set(SearchComponent.INITIAL_TAB);
            }
            return of(null);
          }
          this.loadingArtists.set(true);
          this.loadingTracks.set(false);
          this.loadingAlbums.set(false);
          this.tracks.set([]);
          this.albums.set([]);
          return this.api.get<YtmArtistCard[]>(`search/artists?q=${enc}`).pipe(
            tap((artists) => {
              cache.artists = artists;
              if (gen === this.requestGen) {
                this.artists.set(artists);
              }
            }),
            catchError(() => {
              cache.artists = [];
              if (gen === this.requestGen) {
                this.artists.set([]);
              }
              return of(null);
            }),
            finalize(() => {
              fin('artists')();
              if (gen === this.requestGen) {
                this.visibleLimit.set(SearchComponent.INITIAL_TAB);
              }
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    if (initialQ.trim()) {
      this.query$.next(initialQ);
    }

    this.route.queryParamMap
      .pipe(
        map((params) => (params.get('q') ?? '').toString().trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((urlQuery) => {
        if (urlQuery === this.lastRouteQuery) {
          return;
        }
        this.lastRouteQuery = urlQuery;
        this.inputModel = urlQuery;
        this.writeStoredQuery(urlQuery);
        this.query$.next(urlQuery);
      });

    this.destroyRef.onDestroy(() => {
      this.scrollObserver?.disconnect();
      this.scrollObserver = null;
    });

    effect(() => {
      this.scrollSentinel();
      this.hasSearched();
      this.hasMoreRows();
      this.blockingLoading();
      this.activeTab();
      queueMicrotask(() => this.setupIntersectionObserver());
    });
  }

  private setupIntersectionObserver(): void {
    this.scrollObserver?.disconnect();
    this.scrollObserver = null;
    if (!this.hasSearched() || this.blockingLoading() || !this.hasMoreRows()) {
      return;
    }
    const el = this.scrollSentinel()?.nativeElement;
    if (!el) {
      return;
    }
    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            this.extendVisibleLimit();
          }
        }
      },
      { root: null, rootMargin: '320px', threshold: 0.01 },
    );
    this.scrollObserver.observe(el);
  }

  private extendVisibleLimit(): void {
    const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (t < this.sentinelCooldownUntil) {
      return;
    }
    if (!this.hasSearched() || !this.hasMoreRows() || this.blockingLoading()) {
      return;
    }
    this.sentinelCooldownUntil = t + 350;
    const cap = this.rowCapForTab();
    this.visibleLimit.update((v) => Math.min(v + SearchComponent.PAGE_STEP, cap));
  }

  private static getQueryCache(q: string): QueryPayload {
    const key = q.trim().toLowerCase();
    let e = SearchComponent.queryPayloadCache.get(key);
    if (!e) {
      e = {};
      SearchComponent.queryPayloadCache.set(key, e);
    }
    return e;
  }

  setTab(id: SearchTab): void {
    this.activeTab.set(id);
    this.visibleLimit.set(id === 'all' ? SearchComponent.INITIAL_ALL : SearchComponent.INITIAL_TAB);
    this.writeStoredTab(id);
    sessionStorage.setItem(SearchComponent.LAST_VIEW_KEY, 'search');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onQuery(v: string): void {
    const trimmed = v.trim();
    this.writeStoredQuery(trimmed);
    sessionStorage.setItem(SearchComponent.LAST_VIEW_KEY, 'search');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: trimmed ? trimmed : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseTab(v: string): SearchTab | null {
    if (v === 'tracks' || v === 'albums' || v === 'artists' || v === 'all') {
      return v;
    }
    return null;
  }

  private readStoredQuery(): string {
    return sessionStorage.getItem(SearchComponent.QUERY_STORAGE_KEY) ?? '';
  }

  private writeStoredQuery(value: string): void {
    if (value) {
      sessionStorage.setItem(SearchComponent.QUERY_STORAGE_KEY, value);
      return;
    }
    sessionStorage.removeItem(SearchComponent.QUERY_STORAGE_KEY);
  }

  private readStoredTab(): SearchTab | null {
    const raw = sessionStorage.getItem(SearchComponent.TAB_STORAGE_KEY) ?? '';
    return this.parseTab(raw);
  }

  private writeStoredTab(value: SearchTab): void {
    sessionStorage.setItem(SearchComponent.TAB_STORAGE_KEY, value);
  }
}
