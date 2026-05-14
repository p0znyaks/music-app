import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, of, shareReplay, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';
  private cacheVersion = 0;
  private readonly inflightGet = new Map<string, Observable<unknown>>();
  private readonly MAX_COMPLETED = 50;

  private url(path: string): string {
    const p = path.startsWith('/') ? path.slice(1) : path;
    return `${this.base}/${p}`;
  }

  get<T>(path: string): Observable<T> {
    const sep = path.includes('?') ? '&' : '?';
    const key = this.url(`${path}${sep}_cb=${this.cacheVersion}`);

    const existing = this.inflightGet.get(key);
    if (existing) {
      return existing as Observable<T>;
    }

    const req$ = this.http.get<T>(key).pipe(
      finalize(() => this.inflightGet.delete(key)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.inflightGet.set(key, req$ as Observable<unknown>);
    return req$;
  }

  private bust(): void {
    this.cacheVersion++;
    this.inflightGet.clear();
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body).pipe(tap(() => this.bust()));
  }

  /** 204 No Content — тело пустое, используем text. */
  delete(path: string): Observable<string | null> {
    return this.http.delete(this.url(path), { responseType: 'text' }).pipe(tap(() => this.bust()));
  }
}
