import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';
  private readonly inflightGet = new Map<string, Observable<unknown>>();
  private readonly completedGetCache = new Map<string, { data: unknown; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly MAX_CACHED = 50;

  private url(path: string): string {
    const p = path.startsWith('/') ? path.slice(1) : path;
    return `${this.base}/${p}`;
  }

  get<T>(path: string): Observable<T> {
    const key = this.url(path);

    const existing = this.inflightGet.get(key);
    if (existing) {
      return existing as Observable<T>;
    }

    const cached = this.completedGetCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return of(cached.data as T);
    }
    if (cached) {
      this.completedGetCache.delete(key);
    }

    const req$ = this.http.get<T>(key).pipe(
      tap((data) => {
        if (this.completedGetCache.size >= this.MAX_CACHED) {
          const oldest = this.completedGetCache.keys().next();
          if (!oldest.done && oldest.value) {
            this.completedGetCache.delete(oldest.value);
          }
        }
        this.completedGetCache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
      }),
      finalize(() => this.inflightGet.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.inflightGet.set(key, req$ as Observable<unknown>);
    return req$;
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  /** 204 No Content — тело пустое, используем text. */
  delete(path: string): Observable<string | null> {
    return this.http.delete(this.url(path), { responseType: 'text' });
  }
}
