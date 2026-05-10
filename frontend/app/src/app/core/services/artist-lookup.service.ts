import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay } from 'rxjs';
import { ApiService } from './api.service';

type ArtistSearchHit = { browseId: string; name: string };

@Injectable({ providedIn: 'root' })
export class ArtistLookupService {
  private readonly api = inject(ApiService);
  private readonly cache = new Map<string, string | null>();
  private readonly inflight = new Map<string, Observable<string | null>>();

  resolveBrowseIdByName(name: string): Observable<string | null> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      return of(null);
    }
    if (this.cache.has(normalized)) {
      return of(this.cache.get(normalized) ?? null);
    }
    const existing = this.inflight.get(normalized);
    if (existing) {
      return existing;
    }

    const enc = encodeURIComponent(name.trim());
    const req$ = this.api.get<ArtistSearchHit[]>(`search/artists?q=${enc}`).pipe(
      map((artists) => {
        if (!artists || artists.length === 0) {
          return null;
        }
        const exact = artists.find((a) => a.name.trim().toLowerCase() === normalized);
        return (exact ?? artists[0])?.browseId ?? null;
      }),
      catchError(() => of(null)),
      map((browseId) => {
        this.cache.set(normalized, browseId);
        return browseId;
      }),
      finalize(() => this.inflight.delete(normalized)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.inflight.set(normalized, req$);
    return req$;
  }
}
