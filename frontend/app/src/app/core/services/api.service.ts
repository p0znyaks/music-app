import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';
  private readonly inflightGet = new Map<string, Observable<unknown>>();

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

    const req$ = this.http.get<T>(key).pipe(
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
