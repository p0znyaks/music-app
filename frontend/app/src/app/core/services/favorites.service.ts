import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { TagsService } from './tags.service';
import type { AppTrack } from '../../shared/models/track.model';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly api = inject(ApiService);
  private readonly tags = inject(TagsService);

  private readonly trackIds$ = new BehaviorSubject<string[]>([]);
  private loadState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

  private normalizeId(trackId: string): string {
    return (typeof trackId === 'string' ? trackId : '').trim();
  }

  /** Массив trackId избранных треков (кэш). */
  readonly favorites$ = this.trackIds$.asObservable();

  /** Загружает список с сервера и обновляет кэш. */
  loadFavorites(): void {
    if (this.loadState === 'loading') {
      return;
    }
    this.loadState = 'loading';
    this.api.get<Array<{ trackId: string }>>('favorites').subscribe({
      next: (list) => {
        this.setFavorites(list.map((x) => x.trackId));
        this.loadState = 'loaded';
      },
      error: () => {
        this.trackIds$.next([]);
        this.loadState = 'error';
      },
    });
  }

  /**
   * Гарантирует, что избранное попытались загрузить хотя бы 1 раз.
   * Нужен для экранов (например, поиск), которые рендерятся раньше,
   * чем явная загрузка избранного на странице Favorites.
   */
  ensureLoaded(): void {
    if (this.loadState === 'loaded' || this.loadState === 'loading') {
      return;
    }
    this.loadFavorites();
  }

  /**
   * Принудительно обновляет кэш избранного.
   * Полезно, когда страница уже получила список избранных треков и хочет синхронизировать UI-состояние (сердечки).
   */
  setFavorites(trackIds: string[]): void {
    const normalized = trackIds
      .map((id) => this.normalizeId(id))
      .filter((id) => !!id);
    this.trackIds$.next([...new Set(normalized)]);
  }

  /** Проверяет наличие trackId в текущем кэше. */
  isFavorite(trackId: string): boolean {
    const id = this.normalizeId(trackId);
    return !!id && this.trackIds$.value.includes(id);
  }

  /** POST /api/favorites; после успеха добавляет trackId в кэш. */
  addFavorite(track: AppTrack): Observable<unknown> {
    const id = this.normalizeId(track.trackId);
    return this.api
      .post('favorites', {
        trackId: id,
        title: track.title,
        artist: track.artist,
        thumbnailUrl: track.thumbnailUrl ?? undefined,
        duration: track.duration ?? undefined,
      })
      .pipe(
        tap(() => {
          const cur = this.trackIds$.value;
          if (id && !cur.includes(id)) {
            this.trackIds$.next([...cur, id]);
          }
        }),
      );
  }

  /** DELETE /api/favorites/:trackId; после успеха убирает из кэша. */
  removeFavorite(trackId: string, force = false): Observable<string | null> {
    const id = this.normalizeId(trackId);
    const enc = encodeURIComponent(id);
    const path = force ? `favorites/${enc}?force=1` : `favorites/${enc}`;
    return this.api.delete(path).pipe(
      tap(() => {
        if (!id) {
          return;
        }
        this.trackIds$.next(this.trackIds$.value.filter((x) => x !== id));
        this.tags.invalidate();
      }),
    );
  }

  clear(): void {
    this.trackIds$.next([]);
    this.loadState = 'idle';
  }
}
