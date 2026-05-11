import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { FavoritesService } from './favorites.service';
import { PlayerService } from './player.service';
import { TagsService } from './tags.service';

const TOKEN_KEY = 'muze_token';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

type JwtPayload = {
  id?: number;
  email?: string;
  role?: string;
  exp?: number;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly favorites = inject(FavoritesService);
  private readonly player = inject(PlayerService);
  private readonly tags = inject(TagsService);

  readonly currentUser$ = new BehaviorSubject<AuthUser | null>(null);

  constructor() {
    this.hydrateFromStorage();
  }

  getToken(): string {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }
    return !!this.decodeUser(token);
  }

  login(email: string, password: string): Observable<{ token: string }> {
    return this.api.post<{ token: string }>('auth/login', { email, password }).pipe(
      tap((res) => this.persistToken(res.token)),
    );
  }

  register(username: string, email: string, password: string): Observable<{ token: string }> {
    return this.api.post<{ token: string }>('auth/register', { username, email, password }).pipe(
      tap((res) => this.persistToken(res.token)),
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('personalMixMixes');
    localStorage.removeItem('personalMixHour');
    this.currentUser$.next(null);
    this.favorites.clear();
    this.player.reset();
    this.tags.invalidate();
  }

  private persistToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    const user = this.decodeUser(token);
    this.currentUser$.next(user);
    if (user) {
      this.favorites.loadFavorites();
    } else {
      this.favorites.clear();
    }
  }

  private hydrateFromStorage(): void {
    const token = this.getToken();
    if (!token) {
      return;
    }
    if (this.isTokenExpired(token)) {
      this.logout();
      return;
    }
    const user = this.decodeUser(token);
    if (user) {
      this.currentUser$.next(user);
      this.favorites.loadFavorites();
    } else {
      this.logout();
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload) {
      return true;
    }
    if (typeof payload.exp !== 'number') {
      // если токен не JWT или без exp — считаем невалидным для приложения
      return true;
    }
    // небольшой допуск на рассинхрон часов/границы секунд
    const nowSec = Math.floor(Date.now() / 1000);
    const skewSec = 10;
    return nowSec >= payload.exp - skewSec;
  }

  private decodePayload(token: string): JwtPayload | null {
    try {
      const part = token.split('.')[1];
      if (!part) {
        return null;
      }
      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }

  private decodeUser(token: string): AuthUser | null {
    try {
      const payload = this.decodePayload(token);
      if (!payload) {
        return null;
      }
      if (payload.id == null || !payload.email || !payload.role) {
        return null;
      }
      return { id: payload.id, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }
}
