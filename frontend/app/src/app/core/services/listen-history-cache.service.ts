import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface CachedListenHistoryRow {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  listenedAt: string;
}

type RawCachedListenHistoryRow = Partial<CachedListenHistoryRow>;

@Injectable({ providedIn: 'root' })
export class ListenHistoryCacheService {
  private readonly auth = inject(AuthService);
  private readonly maxItems = 500;
  private readonly keyPrefix = 'muze_listen_history_';

  record(track: { trackId: string; title: string; artist: string; thumbnailUrl?: string | null; duration?: number | null }): void {
    const trackId = track.trackId?.trim();
    const title = track.title?.trim();
    const artist = track.artist?.trim();
    if (!trackId || !title || !artist) {
      return;
    }

    const key = this.getStorageKey();
    if (!key) {
      return;
    }

    const prev = this.readRaw(key);
    const existingIdx = prev.findIndex((r) => r.trackId === trackId);
    
    const nowIso = new Date().toISOString();
    const nextRow: CachedListenHistoryRow = {
      id: existingIdx >= 0 ? prev[existingIdx]!.id : this.localIdFromIso(nowIso),
      trackId,
      title,
      artist,
      thumbnailUrl: track.thumbnailUrl ?? null,
      duration: track.duration ?? null,
      listenedAt: nowIso,
    };

    const withoutOld = existingIdx >= 0 ? [...prev.slice(0, existingIdx), ...prev.slice(existingIdx + 1)] : prev;
    const next = [nextRow, ...withoutOld]
      .filter((r) => this.isValid(r))
      .sort((a, b) => new Date(b.listenedAt).getTime() - new Date(a.listenedAt).getTime())
      .slice(0, this.maxItems);

    this.writeRaw(key, next);
  }

  mergeAndPersist(serverRows: CachedListenHistoryRow[]): CachedListenHistoryRow[] {
    const key = this.getStorageKey();
    if (!key) {
      return this.normalizeRows(serverRows);
    }

    const localRows = this.readRaw(key);
    const merged = this.mergeRows(this.normalizeRows(serverRows), localRows);
    this.writeRaw(key, merged);
    return merged;
  }

  private mergeRows(primary: CachedListenHistoryRow[], secondary: CachedListenHistoryRow[]): CachedListenHistoryRow[] {
    const map = new Map<string, CachedListenHistoryRow>();
    
    for (const row of [...primary, ...secondary]) {
      if (!this.isValid(row)) {
        continue;
      }
      
      const existing = map.get(row.trackId);
      if (!existing) {
        map.set(row.trackId, row);
      } else {
        const existingTs = new Date(existing.listenedAt).getTime();
        const rowTs = new Date(row.listenedAt).getTime();
        if (rowTs > existingTs) {
          map.set(row.trackId, row);
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => new Date(b.listenedAt).getTime() - new Date(a.listenedAt).getTime())
      .slice(0, this.maxItems);
  }

  private normalizeRows(rows: CachedListenHistoryRow[]): CachedListenHistoryRow[] {
    return rows
      .filter((r) => this.isValid(r))
      .map((r) => ({
        id: typeof r.id === 'number' && Number.isFinite(r.id) ? r.id : this.localIdFromIso(r.listenedAt),
        trackId: r.trackId.trim(),
        title: r.title.trim(),
        artist: r.artist.trim(),
        thumbnailUrl: r.thumbnailUrl ?? null,
        duration: r.duration ?? null,
        listenedAt: r.listenedAt,
      }));
  }

  private isValid(row: RawCachedListenHistoryRow): row is CachedListenHistoryRow {
    return (
      typeof row.trackId === 'string' &&
      !!row.trackId.trim() &&
      typeof row.title === 'string' &&
      !!row.title.trim() &&
      typeof row.artist === 'string' &&
      !!row.artist.trim() &&
      typeof row.listenedAt === 'string' &&
      Number.isFinite(new Date(row.listenedAt).getTime())
    );
  }

  private readRaw(key: string): CachedListenHistoryRow[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((r): r is CachedListenHistoryRow => this.isValid(r as RawCachedListenHistoryRow));
    } catch {
      return [];
    }
  }

  private writeRaw(key: string, rows: CachedListenHistoryRow[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(rows));
    } catch {
      // ignore storage quota/availability errors
    }
  }

  private getStorageKey(): string | null {
    const token = this.auth.getToken();
    if (!token) {
      return null;
    }
    const payloadPart = token.split('.')[1];
    if (!payloadPart) {
      return null;
    }
    try {
      const json = atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(json) as { id?: number };
      if (typeof payload.id !== 'number' || !Number.isFinite(payload.id)) {
        return null;
      }
      return `${this.keyPrefix}${payload.id}`;
    } catch {
      return null;
    }
  }

  private localIdFromIso(iso: string): number {
    const ts = new Date(iso).getTime();
    const safeTs = Number.isFinite(ts) ? ts : Date.now();
    return safeTs;
  }
}
