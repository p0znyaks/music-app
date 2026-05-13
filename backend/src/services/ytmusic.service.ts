import { redisGetSWR } from './cache-swr';
import { getPythonPool } from './python-pool';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return msg.includes('429') || msg.toLowerCase().includes('too many requests');
}

class AsyncSemaphore {
  private readonly queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async use<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

function requirePool() {
  const pool = getPythonPool();
  if (!pool) {
    throw new Error('Python worker pool is not available (set PYTHON_WORKERS>=1)');
  }
  return pool;
}

const TTL_SEARCH_SEC = envInt('REDIS_TTL_YTM_SEARCH_SEC', 86400);
const TTL_DETAIL_SEC = envInt('REDIS_TTL_YTM_DETAIL_SEC', 172800);
const TTL_RADIO_SEC = envInt('REDIS_TTL_YTM_RADIO_SEC', 21600);
const TTL_SONG_SEC = envInt('REDIS_TTL_YTM_SONG_SEC', TTL_DETAIL_SEC);
const YTM_CONCURRENCY = envInt('YTM_UPSTREAM_CONCURRENCY', 4);
const YTM_MAX_RETRIES = envInt('YTM_429_RETRIES', 2);
const ytmLimiter = new AsyncSemaphore(YTM_CONCURRENCY);

export interface YtmAlbumSearchHit {
  browseId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  year: string;
}

export interface YtmArtistSearchHit {
  browseId: string;
  name: string;
  thumbnailUrl: string;
  subscribers: string;
}

export interface YtmAlbumTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

export interface YtmAlbumDetail {
  title: string;
  artist: string;
  year: string;
  thumbnailUrl: string;
  tracks: YtmAlbumTrack[];
}

export interface YtmArtistAlbum {
  browseId: string;
  title: string;
  year: string;
  thumbnailUrl: string;
}

export interface YtmArtistDetail {
  name: string;
  thumbnailUrl: string;
  subscribers: string;
  albums: YtmArtistAlbum[];
  relatedArtists?: YtmArtistSearchHit[];
}

export interface YtmRadioTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

export interface YtmWatchRadio {
  tracks: YtmRadioTrack[];
}

export interface YtmSongDetail {
  trackId: string;
  thumbnailUrl: string;
  duration: number;
}

export type YtmRadioBatchResultItem = {
  videoId: string;
  tracks: YtmRadioTrack[];
  error?: string;
};

export type YtmAlbumsBatchResultItem = {
  query: string;
  albums: YtmAlbumSearchHit[];
  error?: string;
};

async function runYtmusicJson<T>(
  action: 'search_albums' | 'search_artists' | 'search_songs' | 'get_album' | 'get_artist' | 'get_watch_playlist_radio' | 'get_song',
  arg: string,
  extra?: { limit?: number },
): Promise<T> {
  const callOnce = async (): Promise<T> => {
    const pool = requirePool();
    if (action === 'search_albums' || action === 'search_artists' || action === 'search_songs') {
      return ytmLimiter.use(() => pool.call<T>(action, { query: arg }));
    }
    if (action === 'get_watch_playlist_radio') {
      const lim = extra?.limit ?? 60;
      return ytmLimiter.use(() => pool.call<T>(action, { videoId: arg, limit: lim }));
    }
    return ytmLimiter.use(() => pool.call<T>(action, { browseId: arg }));
  };

  let attempt = 0;
  while (true) {
    try {
      return await callOnce();
    } catch (err) {
      if (!isRateLimitedError(err) || attempt >= YTM_MAX_RETRIES) {
        throw err;
      }
      attempt += 1;
      const delayMs = Math.min(500 * Math.pow(2, attempt), 2500) + Math.floor(Math.random() * 250);
      await sleep(delayMs);
    }
  }
}

export class YtmusicService {
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly inflightRefresh = new Map<string, Promise<void>>();

  private normalizeQuery(value: string): string {
    return value.trim().toLowerCase();
  }

  private async cachedJsonSWR<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    return redisGetSWR<T>(
      key,
      ttlSec,
      undefined,
      loader,
      this.inflight as Map<string, Promise<T>>,
      this.inflightRefresh,
    );
  }

  async searchAlbums(query: string): Promise<YtmAlbumSearchHit[]> {
    const q = this.normalizeQuery(query);
    if (!q) {
      return [];
    }
    return this.cachedJsonSWR<YtmAlbumSearchHit[]>(`ytm_albums:v5:${q}`, TTL_SEARCH_SEC, () =>
      runYtmusicJson<YtmAlbumSearchHit[]>('search_albums', q),
    );
  }

  /** Parallel album search for multiple artist names (one Python RPC). */
  async searchAlbumsBatch(queries: string[]): Promise<YtmAlbumsBatchResultItem[]> {
    const qs = [...new Set(queries.map((q) => this.normalizeQuery(q)).filter(Boolean))];
    if (qs.length === 0) {
      return [];
    }
    const pool = requirePool();
    const raw = await ytmLimiter.use(() => pool.call<{ results: YtmAlbumsBatchResultItem[] }>('reco_albums_batch', { queries: qs }));
    return Array.isArray(raw?.results) ? raw.results : [];
  }

  async searchArtists(query: string): Promise<YtmArtistSearchHit[]> {
    const q = this.normalizeQuery(query);
    if (!q) {
      return [];
    }
    return this.cachedJsonSWR<YtmArtistSearchHit[]>(`ytm_artists:v5:${q}`, TTL_SEARCH_SEC, () =>
      runYtmusicJson<YtmArtistSearchHit[]>('search_artists', q),
    );
  }

  async searchSongs(query: string): Promise<YtmRadioTrack[]> {
    const q = this.normalizeQuery(query);
    if (!q) return [];
    return this.cachedJsonSWR<YtmRadioTrack[]>(`ytm_songs:v2:${q}`, TTL_SEARCH_SEC, () =>
      runYtmusicJson<YtmRadioTrack[]>('search_songs', q),
    );
  }

  async getAlbum(browseId: string): Promise<YtmAlbumDetail | null> {
    const id = browseId.trim();
    if (!id) {
      return null;
    }
    return this.cachedJsonSWR<YtmAlbumDetail>(`ytm_album:v3:${id}`, TTL_DETAIL_SEC, () =>
      runYtmusicJson<YtmAlbumDetail>('get_album', id),
    );
  }

  async getArtist(browseId: string): Promise<YtmArtistDetail | null> {
    const id = browseId.trim();
    if (!id) {
      return null;
    }
    return this.cachedJsonSWR<YtmArtistDetail>(`ytm_artist:v4:${id}`, TTL_DETAIL_SEC, () =>
      runYtmusicJson<YtmArtistDetail>('get_artist', id),
    );
  }

  async getWatchPlaylistRadio(trackId: string, limit = 60): Promise<YtmWatchRadio> {
    const id = trackId.trim();
    if (!id) {
      return { tracks: [] };
    }
    const lim = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 60;
    const key = `ytm_radio:v1:${id}:l:${lim}`;
    return this.cachedJsonSWR<YtmWatchRadio>(key, TTL_RADIO_SEC, () =>
      runYtmusicJson<YtmWatchRadio>('get_watch_playlist_radio', id, { limit: lim }),
    );
  }

  /** Parallel watch-radio for multiple video ids (one Python RPC). */
  async getRadioBatch(videoIds: string[], limit = 60): Promise<YtmRadioBatchResultItem[]> {
    const lim = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 60;
    const ids = [...new Set(videoIds.map((v) => v.trim()).filter(Boolean))];
    if (ids.length === 0) {
      return [];
    }
    const pool = requirePool();
    const raw = await ytmLimiter.use(() =>
      pool.call<{ results: YtmRadioBatchResultItem[] }>('reco_radio_batch', { videoIds: ids, limit: lim }),
    );
    return Array.isArray(raw?.results) ? raw.results : [];
  }

  async getSong(trackId: string): Promise<YtmSongDetail | null> {
    const id = trackId.trim();
    if (!id) {
      return null;
    }
    const data = await this.cachedJsonSWR<YtmSongDetail>(`ytm_song:v1:${id}`, TTL_SONG_SEC, () =>
      runYtmusicJson<YtmSongDetail>('get_song', id),
    );
    if (!data || typeof data !== 'object') {
      return null;
    }
    return {
      trackId: id,
      thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : '',
      duration: Number.isFinite(data.duration) ? Math.max(0, Math.floor(data.duration)) : 0,
    };
  }

  async getSongsBatch(trackIds: string[]): Promise<YtmSongDetail[]> {
    const ids = [...new Set(trackIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) {
      return [];
    }
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          return await this.getSong(id);
        } catch {
          return null;
        }
      }),
    );
    return rows.filter((row): row is YtmSongDetail => row !== null);
  }
}

export const ytmusicService = new YtmusicService();
