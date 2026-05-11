import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { ApiService } from './api.service';
import type { AppTrack } from '../../shared/models/track.model';

export type TagSort = 'alpha' | 'createdAt';

@Injectable({ providedIn: 'root' })
export class TagsService {
  private readonly api = inject(ApiService);

  private readonly trackTagsCache = new Map<string, Observable<string[]>>();
  private readonly distinctCache = new Map<string, Observable<string[]>>();

  private readonly changed$ = new BehaviorSubject(0);

  invalidate(): void {
    this.trackTagsCache.clear();
    this.distinctCache.clear();
    this.changed$.next(this.changed$.value + 1);
  }

  /** Теги трека (уникальные, как сохранены на сервере). */
  getTrackTags(trackId: string): Observable<string[]> {
    const tid = (trackId ?? '').trim();
    if (!tid) {
      return of([]);
    }
    const existing = this.trackTagsCache.get(tid);
    if (existing) {
      return existing;
    }

    const real$ = this.changed$.pipe(
      switchMap(() => this.api.get<Array<{ tag: string }>>(`tags/track/${encodeURIComponent(tid)}`)),
      map((rows) => (rows ?? []).map((r) => r.tag).filter((t) => typeof t === 'string' && t.trim().length > 0)),
      map((tags) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const t of tags) {
          const n = t.trim().toLowerCase();
          if (seen.has(n)) continue;
          seen.add(n);
          out.push(t.trim());
        }
        return out;
      }),
      catchError(() => of([])),
    );

    // store real$, ignore req$
    this.trackTagsCache.set(tid, real$);
    return real$;
  }

  /** Уникальные теги пользователя (для списка выбора/страницы Mood/Tags). */
  getDistinctTags(sort: TagSort): Observable<string[]> {
    const s: TagSort = sort === 'alpha' ? 'alpha' : 'createdAt';
    const cached = this.distinctCache.get(s);
    if (cached) {
      return cached;
    }

    const req$ = this.changed$.pipe(
      switchMap(() => this.api.get<Array<{ tag: string }>>(`tags/distinct?sort=${encodeURIComponent(s)}`)),
        map((rows) => (rows ?? []).map((r) => r.tag).filter((t) => typeof t === 'string' && t.trim().length > 0)),
        map((tags) => tags.map((t) => t.trim())),
        catchError(() => of([])),
      );
    this.distinctCache.set(s, req$);
    return req$;
  }

  addTagToTrack(track: AppTrack, tag: string): Observable<unknown> {
    const tid = (track.trackId ?? '').trim();
    const t = tag.trim();
    return this.api
      .post('tags', {
        trackId: tid,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.thumbnailUrl ?? undefined,
        tag: t,
      })
      .pipe(
        tap(() => {
          this.invalidate();
        }),
      );
  }

  removeTagFromTrack(trackId: string, tag: string): Observable<string | null> {
    const tid = (trackId ?? '').trim();
    const t = tag.trim();
    return this.api
      .delete(`tags/track/${encodeURIComponent(tid)}/${encodeURIComponent(t)}`)
      .pipe(
        tap(() => {
          this.invalidate();
        }),
      );
  }
}

