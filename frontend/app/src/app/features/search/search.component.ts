import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import {
  combineLatest,
  debounce,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  of,
  Subject,
  timer,
  switchMap,
} from 'rxjs';
import { FavoritesService } from '../../core/services/favorites.service';
import { AlbumCardComponent } from '../../shared/components/album-card/album-card.component';
import { ArtistCardComponent } from '../../shared/components/artist-card/artist-card.component';
import { TrackCardComponent } from '../../shared/components/track-card/track-card.component';
import { SearchDataService, type SearchTab } from './search-data.service';
import { TranslatePipe } from '../../shared/pipes/t.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { IconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TrackCardComponent,
    AlbumCardComponent,
    ArtistCardComponent,
    TranslatePipe,
    IconComponent,
    EmptyStateComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="page">
      <div class="search-box">
        <app-icon class="lens" name="search" />
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
                <svg
                  class="check-svg"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                >
                  <path
                    class="check-path"
                    d="M3 8.5l3.2 3.2L13 4.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="tab-text">{{ opt.label }}</span>
            </button>
          }
        </div>
      }

      @if (blockingLoading()) {
        <div class="list">
          <app-skeleton [count]="6" />
        </div>
      } @else if (hasSearched()) {
        @if (isEmptyForTab()) {
          <app-empty-state titleKey="nothingFound" />
        } @else if (activeTab() === 'all') {
          <div class="sections">
            <section class="section">
              <h2 class="section-title">{{ 'tracksTab' | t }}</h2>
              @if (loadingTracks()) {
                <div class="list">
                  <app-skeleton [count]="6" />
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
                  <app-skeleton [count]="6" />
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
                  <app-skeleton [count]="6" />
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
  styleUrl: './search.component.css',
})
export class SearchComponent {
  private static readonly QUERY_STORAGE_KEY = 'search.query';
  private static readonly TAB_STORAGE_KEY = 'search.tab';
  private static readonly LAST_VIEW_KEY = 'last.view';

  private static readonly PAGE_STEP = 15;
  private static readonly INITIAL_TAB = 15;
  private static readonly INITIAL_ALL = 24;

  private readonly destroyRef = inject(DestroyRef);
  private readonly data = inject(SearchDataService);
  private readonly favorites = inject(FavoritesService);
  private readonly settings = inject(AppSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly query$ = new Subject<string>();

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
  readonly activeTab = signal<SearchTab>('tracks');
  readonly visibleLimit = signal(SearchComponent.INITIAL_TAB);

  readonly blockingLoading = computed(() => {
    if (!this.hasSearched()) {
      return false;
    }
    const tab = this.activeTab();
    // Not blocking while results are already on screen: the full-page skeleton
    // would hide the rows we just restored from cache while the request for the
    // longer query is still in flight.
    if (tab === 'tracks') {
      return this.loadingTracks() && this.tracks().length === 0;
    }
    if (tab === 'albums') {
      return this.loadingAlbums() && this.albums().length === 0;
    }
    if (tab === 'artists') {
      return this.loadingArtists() && this.artists().length === 0;
    }
    // The "All" tab is not blocking while anything has already arrived: the
    // three requests land in parallel and each section paints as soon as it is
    // ready, so blocking only on "still nothing at all" avoids a spinner over
    // content that is already on screen.
    return (
      this.loadingTracks() &&
      this.loadingAlbums() &&
      this.loadingArtists() &&
      this.tracks().length === 0 &&
      this.albums().length === 0 &&
      this.artists().length === 0
    );
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

    // Debounce scales with how much the user has typed. The first characters
    // change on almost every keystroke and each one would cost a network
    // round-trip, while a long query is usually a deliberate paste or a final
    // correction that should go out immediately.
    const queryDebounced = this.query$.pipe(
      debounce((q) => timer(q.trim().length <= 3 ? 350 : 150)),
      map((q) => q.trim()),
      distinctUntilChanged(),
    );

    combineLatest([queryDebounced, toObservable(this.activeTab)])
      .pipe(
        switchMap(([q, tab]) => {
          const minLenForStructuredSearch =
            tab === 'albums' || tab === 'artists' || tab === 'all' ? 2 : 1;
          if (!q || q.length < minLenForStructuredSearch) {
            this.data.reset(q.length > 0);
            this.visibleLimit.set(SearchComponent.INITIAL_TAB);
            return of(null);
          }
          // The row budget differs per tab and the service cannot know about
          // it, so it is reset here once the results have settled.
          return this.data.run(q, tab).pipe(
            finalize(() => {
              this.visibleLimit.set(
                tab === 'all' ? SearchComponent.INITIAL_ALL : SearchComponent.INITIAL_TAB,
              );
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

  readonly loadingTracks = this.data.loadingTracks;
  readonly loadingAlbums = this.data.loadingAlbums;
  readonly loadingArtists = this.data.loadingArtists;
  readonly tracks = this.data.tracks;
  readonly albums = this.data.albums;
  readonly artists = this.data.artists;
  readonly hasSearched = this.data.hasSearched;
}
