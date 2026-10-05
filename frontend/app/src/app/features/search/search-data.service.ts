import { Injectable, signal, inject } from '@angular/core';
import { catchError, finalize, merge, Observable, of, tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import type { AppTrack } from '../../shared/models/track.model';
import type { SearchBundle, YtmAlbumCard, YtmArtistCard } from './search.model';

export type SearchTab = 'tracks' | 'albums' | 'artists' | 'all';

/** Result cache for a single query; a slot is filled the first time it loads. */
export interface QueryPayload {
  tracks?: AppTrack[];
  albums?: YtmAlbumCard[];
  artists?: YtmArtistCard[];
}

/**
 * Shortest cached query that may stand in for a longer one being typed.
 * Two letters are too short to be meaningful on their own.
 */
const PREFIX_MIN_LEN = 3;

/**
 * Owns search state and the requests behind it, so the component only decides
 * *when* to search and *what* to paint.
 *
 * Root-provided on purpose: the result cache then outlives the component, so
 * returning to the search page does not hit the network again.
 */
@Injectable({ providedIn: 'root' })
export class SearchDataService {
  /** Cache bound. Exceeding it evicts the least recently used query. */
  private static readonly CACHE_LIMIT = 30;

  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, QueryPayload>();

  /** Bumped per request; responses from superseded requests are discarded. */
  private requestGen = 0;

  readonly tracks = signal<AppTrack[]>([]);
  readonly albums = signal<YtmAlbumCard[]>([]);
  readonly artists = signal<YtmArtistCard[]>([]);

  readonly loadingTracks = signal(false);
  readonly loadingAlbums = signal(false);
  readonly loadingArtists = signal(false);

  readonly hasSearched = signal(false);

  /**
   * Tracks of the longest cached query that is a prefix of `q`, or null.
   *
   * Painted immediately while the real request is still in flight, so typing
   * "rih" then "rihanna" shows the "ri" result instead of a blank screen.
   */
  findCachedTracks(q: string): AppTrack[] | null {
    const needle = q.trim().toLowerCase();
    if (needle.length < PREFIX_MIN_LEN) {
      return null;
    }
    let best: string | null = null;
    for (const key of this.cache.keys()) {
      if (
        key.length <= needle.length &&
        needle.startsWith(key) &&
        (best === null || key.length > best.length)
      ) {
        best = key;
      }
    }
    return best === null ? null : (this.cache.get(best)?.tracks ?? null);
  }

  /** Drops every result. `searched` reflects whether a query was entered. */
  reset(searched: boolean): void {
    this.requestGen += 1;
    this.loadingTracks.set(false);
    this.loadingAlbums.set(false);
    this.loadingArtists.set(false);
    this.tracks.set([]);
    this.albums.set([]);
    this.artists.set([]);
    this.hasSearched.set(searched);
  }

  /** Empties the two slots the given tab does not display. */
  private clearOthers(active: 'tracks' | 'albums' | 'artists'): void {
    if (active !== 'tracks') {
      this.tracks.set([]);
      this.loadingTracks.set(false);
    }
    if (active !== 'albums') {
      this.albums.set([]);
      this.loadingAlbums.set(false);
    }
    if (active !== 'artists') {
      this.artists.set([]);
      this.loadingArtists.set(false);
    }
  }

  /**
   * Loads results for `q` on `tab`.
   *
   * Cache hits resolve without a request. On the "all" tab the three requests
   * are merged, not concatenated, so the tab costs the slowest single
   * round-trip instead of the sum of all three.
   */
  run(q: string, tab: SearchTab): Observable<unknown> {
    const gen = (this.requestGen += 1);
    const enc = encodeURIComponent(q);
    const payload = this.payloadFor(q);
    this.hasSearched.set(true);

    if (tab === 'tracks') {
      const prefix = this.findCachedTracks(q);
      if (prefix) {
        this.tracks.set(prefix);
      }
    }

    const loaders = {
      tracks: () => this.loadTracks(q, enc, payload, gen),
      albums: () => this.loadAlbums(enc, payload, gen),
      artists: () => this.loadArtists(enc, payload, gen),
    };

    if (tab !== 'all') {
      return loaders[tab]();
    }

    const streams: Observable<unknown>[] = [];
    for (const kind of ['tracks', 'albums', 'artists'] as const) {
      if (payload[kind]) {
        this.setSlot(kind, payload[kind]!);
        this.loadingFor(kind).set(false);
      } else {
        streams.push(loaders[kind]());
      }
    }
    return streams.length === 0 ? of(null) : merge(...streams);
  }

  private loadTracks(
    q: string,
    enc: string,
    payload: QueryPayload,
    gen: number,
  ): Observable<unknown> {
    if (payload.tracks) {
      const sorted = sortTracksByArtistQuery(payload.tracks, q);
      payload.tracks = sorted;
      this.clearOthers('tracks');
      this.tracks.set(sorted);
      this.loadingTracks.set(false);
      return of(null);
    }
    this.loadingTracks.set(true);
    this.clearOthers('tracks');
    return this.api.get<SearchBundle>(`search?q=${enc}`).pipe(
      tap((bundle) => {
        payload.tracks = sortTracksByArtistQuery(bundle.tracks, q);
        if (gen === this.requestGen) {
          this.tracks.set(payload.tracks);
        }
      }),
      catchError(() => {
        payload.tracks = [];
        if (gen === this.requestGen) {
          this.tracks.set([]);
        }
        return of(null);
      }),
      finalize(() => {
        if (gen === this.requestGen) {
          this.loadingTracks.set(false);
        }
      }),
    );
  }

  private loadAlbums(enc: string, payload: QueryPayload, gen: number): Observable<unknown> {
    if (payload.albums) {
      this.clearOthers('albums');
      this.albums.set(payload.albums);
      this.loadingAlbums.set(false);
      return of(null);
    }
    this.loadingAlbums.set(true);
    this.clearOthers('albums');
    return this.api.get<YtmAlbumCard[]>(`search/albums?q=${enc}`).pipe(
      tap((albums) => {
        payload.albums = albums;
        if (gen === this.requestGen) {
          this.albums.set(albums);
        }
      }),
      catchError(() => {
        payload.albums = [];
        if (gen === this.requestGen) {
          this.albums.set([]);
        }
        return of(null);
      }),
      finalize(() => {
        if (gen === this.requestGen) {
          this.loadingAlbums.set(false);
        }
      }),
    );
  }

  private loadArtists(enc: string, payload: QueryPayload, gen: number): Observable<unknown> {
    if (payload.artists) {
      this.clearOthers('artists');
      this.artists.set(payload.artists);
      this.loadingArtists.set(false);
      return of(null);
    }
    this.loadingArtists.set(true);
    this.clearOthers('artists');
    return this.api.get<YtmArtistCard[]>(`search/artists?q=${enc}`).pipe(
      tap((artists) => {
        payload.artists = artists;
        if (gen === this.requestGen) {
          this.artists.set(artists);
        }
      }),
      catchError(() => {
        payload.artists = [];
        if (gen === this.requestGen) {
          this.artists.set([]);
        }
        return of(null);
      }),
      finalize(() => {
        if (gen === this.requestGen) {
          this.loadingArtists.set(false);
        }
      }),
    );
  }

  private setSlot(kind: 'tracks' | 'albums' | 'artists', rows: unknown[]): void {
    if (kind === 'tracks') {
      this.tracks.set(rows as AppTrack[]);
    } else if (kind === 'albums') {
      this.albums.set(rows as YtmAlbumCard[]);
    } else {
      this.artists.set(rows as YtmArtistCard[]);
    }
  }

  private loadingFor(kind: 'tracks' | 'albums' | 'artists') {
    return kind === 'tracks'
      ? this.loadingTracks
      : kind === 'albums'
        ? this.loadingAlbums
        : this.loadingArtists;
  }

  private payloadFor(q: string): QueryPayload {
    const key = q.trim().toLowerCase();
    let payload = this.cache.get(key);
    if (!payload) {
      payload = {};
    }
    // Re-insert so the Map's iteration order tracks recency.
    this.cache.delete(key);
    this.cache.set(key, payload);
    while (this.cache.size > SearchDataService.CACHE_LIMIT) {
      const oldest = this.cache.keys().next();
      if (oldest.done) {
        break;
      }
      this.cache.delete(oldest.value);
    }
    return payload;
  }
}

/**
 * Hoists tracks whose artist matches the query exactly. Searching for an artist
 * should surface their songs, not whichever track happens to rank first.
 */
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
