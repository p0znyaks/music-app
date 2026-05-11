import { spawn } from 'child_process';
import { redisGetSWR } from './cache-swr';
import { getPythonPool } from './python-pool';
import { getRedis } from './redis';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const CACHE_TTL_SEC = envInt('REDIS_TTL_YTDLP_SEC', 86400);
const META_TTL_SEC = envInt('REDIS_TTL_YTDLP_META_SEC', CACHE_TTL_SEC);
const STREAM_TTL_SEC = envInt('REDIS_TTL_STREAM_SEC', 86400);
const STREAM_RETRY_DELAY_MS = 2000;

const POPULAR_TRACK_HEAD = 18;

export interface SearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number | string;
  channelId?: string;
}

export interface ArtistPageTrackRow extends SearchResult {
  viewCount: number;
  albumTitle: string | null;
}

export interface ArtistPageDto {
  channelId: string;
  name: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  description: string | null;
  topTracks: ArtistPageTrackRow[];
  albums: SearchAlbumDto[];
}

export interface SearchAlbumDto {
  albumId: string;
  title: string;
  artist: string;
  year: number | null;
  thumbnailUrl: string;
}

export interface SearchArtistDto {
  id: string;
  name: string;
  thumbnailUrl: string;
}

export interface SearchBundle {
  tracks: SearchResult[];
  albums: SearchAlbumDto[];
  artists: SearchArtistDto[];
}

export type SearchWorkerPhase =
  | { phase: 'meta'; query: string }
  | { phase: 'tracks'; partial: boolean; items: SearchResult[] }
  | { phase: 'albums'; items: SearchAlbumDto[] }
  | { phase: 'artists'; items: SearchArtistDto[] }
  | { phase: 'bundle'; bundle: SearchBundle };

export interface AlbumSearchHit {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
  itemCount: number;
}

export interface TrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

function ytdlpBinary(): string {
  return process.env.YTDLP_PATH?.trim() || 'yt-dlp';
}

function ytdlpCookieFlags(): string[] {
  const browser = process.env.YTDLP_COOKIES_BROWSER?.trim();
  if (!browser) {
    const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
    if (cookiesFile) {
      return ['--cookies', cookiesFile];
    }
    return [];
  }
  const configPath = process.env.YTDLP_BROWSER_CONFIG_PATH?.trim();
  if (configPath) {
    return ['--cookies-from-browser', browser, configPath];
  }
  return ['--cookies-from-browser', browser];
}

function runYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = ytdlpBinary();
    const allArgs = [...ytdlpCookieFlags(), ...args];
    const proc = spawn(bin, allArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    proc.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function requirePythonPool() {
  const pool = getPythonPool();
  if (!pool) {
    throw new Error('Python worker pool is not available (set PYTHON_WORKERS>=1)');
  }
  return pool;
}

async function runYtdlpFlat(url: string, playlistEnd: number): Promise<string> {
  return runYtdlp([
    url,
    '--dump-json',
    '--flat-playlist',
    '--playlist-end',
    String(playlistEnd),
    '--no-download',
  ]);
}

function pickThumbnail(entry: Record<string, unknown>): string {
  if (typeof entry.thumbnail === 'string' && entry.thumbnail) {
    return entry.thumbnail;
  }
  const thumbs = entry.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const first = thumbs[0] as Record<string, unknown>;
    if (typeof first.url === 'string') {
      return first.url;
    }
  }
  return '';
}

function pickChannelThumbnail(entry: Record<string, unknown>): string {
  const ch = entry.channel_thumbnail;
  if (typeof ch === 'string' && ch) {
    return ch;
  }
  const ut = entry.uploader_thumbnail;
  if (typeof ut === 'string' && ut) {
    return ut;
  }
  const uat = entry.uploader_avatar_url;
  if (typeof uat === 'string' && uat) {
    return uat;
  }
  return '';
}

function pickArtist(entry: Record<string, unknown>): string {
  const a = entry.artist;
  if (typeof a === 'string' && a) {
    return a;
  }
  const u = entry.uploader;
  if (typeof u === 'string' && u) {
    return u;
  }
  const c = entry.channel;
  if (typeof c === 'string' && c) {
    return c;
  }
  return '';
}

function parseDuration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const n = value > 24 * 60 * 60 ? value / 1000 : value;
    return Math.max(0, Math.floor(n));
  }
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) {
      return 0;
    }
    if (/^\d+(\.\d+)?$/.test(raw)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n <= 0) {
        return 0;
      }
      const sec = n > 24 * 60 * 60 ? n / 1000 : n;
      return Math.max(0, Math.floor(sec));
    }
    const parts = raw.split(':').map((p) => Number(p.trim()));
    if (parts.some((p) => !Number.isFinite(p) || p < 0)) {
      return 0;
    }
    if (parts.length === 2) {
      return Math.floor(parts[0]! * 60 + parts[1]!);
    }
    if (parts.length === 3) {
      return Math.floor(parts[0]! * 3600 + parts[1]! * 60 + parts[2]!);
    }
  }
  return 0;
}

function pickPlaylistCount(entry: Record<string, unknown>): number {
  const n = entry.playlist_count;
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.floor(n);
  }
  return 0;
}

function pickChannelOrUploader(entry: Record<string, unknown>): string {
  const c = entry.channel;
  if (typeof c === 'string' && c.trim()) {
    return c.trim();
  }
  const u = entry.uploader;
  if (typeof u === 'string' && u.trim()) {
    return u.trim();
  }
  return '';
}

const FULL_ALBUM_TITLE_RE = /\s*[\[(]?full\s+album[)\]]?\s*/gi;

function cleanAlbumSearchTitle(raw: string): string {
  return raw.replace(FULL_ALBUM_TITLE_RE, ' ').replace(/\s+/g, ' ').trim();
}

function pickViewCount(entry: Record<string, unknown>): number {
  const v = entry.view_count;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.floor(v);
  }
  return 0;
}

function pickYear(entry: Record<string, unknown>): number | null {
  const ry = entry.release_year;
  if (typeof ry === 'number' && Number.isFinite(ry) && ry > 1900) {
    return Math.floor(ry);
  }
  const rd = entry.release_date;
  if (typeof rd === 'string' && rd.length >= 4) {
    const y = parseInt(rd.slice(0, 4), 10);
    if (!Number.isNaN(y) && y > 1900) {
      return y;
    }
  }
  const ud = entry.upload_date;
  if (typeof ud === 'string' && ud.length >= 4) {
    const y = parseInt(ud.slice(0, 4), 10);
    if (!Number.isNaN(y) && y > 1900) {
      return y;
    }
  }
  return null;
}

function pickChannelId(entry: Record<string, unknown>): string {
  const c = entry.channel_id;
  return typeof c === 'string' && c ? c : '';
}

function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      out.push(JSON.parse(trimmed) as Record<string, unknown>);
    } catch {
      continue;
    }
  }
  return out;
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'feat', 'ft',
  'и', 'в', 'на', 'из', 'для',
]);

function normText(s: string): string {
  return s.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function significantTokens(q: string): string[] {
  return normText(q).split(/\s+/).filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function isYoutubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function isYoutubeChannelId(id: string): boolean {
  return /^UC[a-zA-Z0-9_-]{22}$/.test(id);
}

function pickTrackAlbumTitle(entry: Record<string, unknown>): string | null {
  const album = entry.album;
  if (typeof album === 'string' && album.trim()) {
    return album.trim();
  }
  return null;
}

function mapArtistPageTrack(entry: Record<string, unknown>, fallbackArtist: string): ArtistPageTrackRow | null {
  const id = entry.id;
  if (typeof id !== 'string' || !id || !isYoutubeVideoId(id)) {
    return null;
  }
  const duration = parseDuration(entry.duration);
  if (duration > 0 && duration < 18) {
    return null;
  }
  const title = typeof entry.title === 'string' ? entry.title : '';
  const artist = pickArtist(entry).trim() || fallbackArtist;
  const ch = pickChannelId(entry);
  const base: SearchResult = {
    trackId: id,
    title,
    artist,
    thumbnailUrl: pickThumbnail(entry),
    duration,
    ...(ch ? { channelId: ch } : {}),
  };
  return {
    ...base,
    viewCount: pickViewCount(entry),
    albumTitle: pickTrackAlbumTitle(entry),
  };
}

function rankArtistTrackEntries(
  entries: Record<string, unknown>[],
  fallbackArtist: string,
  maxOut: number,
): ArtistPageTrackRow[] {
  const withRows = entries
    .map((entry) => ({ entry, row: mapArtistPageTrack(entry, fallbackArtist) }))
    .filter((x): x is { entry: Record<string, unknown>; row: ArtistPageTrackRow } => x.row !== null);

  const anyViews = withRows.some((x) => pickViewCount(x.entry) > 0);

  if (anyViews) {
    const sorted = [...withRows].sort((a, b) => pickViewCount(b.entry) - pickViewCount(a.entry));
    const head = sorted.slice(0, POPULAR_TRACK_HEAD);
    const headIds = new Set(head.map((h) => h.row.trackId));
    const tail = sorted.slice(POPULAR_TRACK_HEAD).filter((x) => !headIds.has(x.row.trackId));
    shuffleInPlace(tail);
    return [...head, ...tail].slice(0, maxOut).map((x) => x.row);
  }

  const head = withRows.slice(0, POPULAR_TRACK_HEAD);
  const tail = withRows.slice(POPULAR_TRACK_HEAD);
  shuffleInPlace(tail);
  return [...head, ...tail].slice(0, maxOut).map((x) => x.row);
}

function mapChannelPlaylistAlbum(entry: Record<string, unknown>, channelTitle: string): SearchAlbumDto | null {
  const playlistId = pickPlaylistId(entry);
  if (!playlistId) {
    return null;
  }
  const title = typeof entry.title === 'string' ? entry.title : '';
  if (!title.trim()) {
    return null;
  }
  const low = title.toLowerCase();
  if (low.includes('watch later') || low === 'likes' || low === 'favorites' || low === 'избранное') {
    return null;
  }
  const artist = stripTopicSuffix(pickArtist(entry).trim()) || channelTitle;
  const thumb = pickThumbnail(entry) || pickChannelThumbnail(entry);
  return {
    albumId: playlistId,
    title,
    artist,
    year: pickYear(entry),
    thumbnailUrl: thumb,
  };
}

function rankChannelAlbums(entries: Record<string, unknown>[], channelTitle: string, maxOut: number): SearchAlbumDto[] {
  const rows: SearchAlbumDto[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const pl = mapChannelPlaylistAlbum(entry, channelTitle);
    if (!pl || seen.has(pl.albumId)) {
      continue;
    }
    seen.add(pl.albumId);
    rows.push(pl);
  }
  rows.sort((a, b) => {
    const ya = a.year ?? 0;
    const yb = b.year ?? 0;
    if (yb !== ya) {
      return yb - ya;
    }
    return a.title.localeCompare(b.title);
  });
  return rows.slice(0, maxOut);
}

async function resolveChannelFromHint(
  channelIdParam: string | null,
  nameHint: string,
): Promise<{ channelId: string; name: string; thumbnailUrl: string } | null> {
  const trimmedName = nameHint.trim();
  if (channelIdParam && isYoutubeChannelId(channelIdParam)) {
    return { channelId: channelIdParam, name: trimmedName || 'Исполнитель', thumbnailUrl: '' };
  }
  if (!trimmedName) {
    return null;
  }
  const stdout = await runYtdlpFlat(`ytsearch15:${trimmedName}`, 15);
  const rows = parseJsonLines(stdout);
  const qn = normText(stripTopicSuffix(trimmedName));
  let best: { ch: string; name: string; thumb: string } | null = null;
  for (const e of rows) {
    const ch = pickChannelId(e);
    if (!ch || !isYoutubeChannelId(ch)) {
      continue;
    }
    const art = normText(stripTopicSuffix(pickArtist(e)));
    if (!art) {
      continue;
    }
    if (art === qn || art.includes(qn) || significantTokens(trimmedName).every((t) => art.includes(t))) {
      best = {
        ch,
        name: stripTopicSuffix(pickArtist(e)) || trimmedName,
        thumb: pickChannelThumbnail(e) || pickThumbnail(e),
      };
      break;
    }
  }
  if (!best && rows.length > 0) {
    const e = rows[0];
    const ch = pickChannelId(e);
    if (ch && isYoutubeChannelId(ch)) {
      best = {
        ch,
        name: stripTopicSuffix(pickArtist(e)) || trimmedName,
        thumb: pickChannelThumbnail(e) || pickThumbnail(e),
      };
    }
  }
  if (!best) {
    return null;
  }
  return { channelId: best.ch, name: best.name, thumbnailUrl: best.thumb };
}

async function fetchChannelExtras(channelId: string): Promise<{ subscribers: number | null; description: string | null }> {
  try {
    const stdout = await runYtdlp([
      '--dump-json',
      '--playlist-items', '1',
      '--no-download',
      `https://www.youtube.com/channel/${channelId}/videos`,
    ]);
    const line = stdout.trim().split('\n').find((l) => l.trim());
    if (!line) {
      return { subscribers: null, description: null };
    }
    const entry = JSON.parse(line) as Record<string, unknown>;
    let subscribers: number | null = null;
    const fc = entry.channel_follower_count;
    if (typeof fc === 'number' && Number.isFinite(fc)) {
      subscribers = Math.floor(fc);
    }
    let description: string | null = null;
    const desc = entry.description;
    if (typeof desc === 'string' && desc.trim()) {
      description = desc.trim().slice(0, 1200);
    }
    return { subscribers, description };
  } catch {
    return { subscribers: null, description: null };
  }
}

function stripTopicSuffix(s: string): string {
  return s.replace(/\s*[\u2013\u2014-]\s*topic\s*$/i, '').trim();
}

function pickPlaylistId(entry: Record<string, unknown>): string | null {
  const plField = entry.playlist_id;
  if (typeof plField === 'string' && plField && !isYoutubeVideoId(plField) && !plField.startsWith('RD')) {
    return plField;
  }
  const id = entry.id;
  if (typeof id === 'string' && id && !isYoutubeVideoId(id) && !id.startsWith('RD')) {
    return id;
  }
  const url = entry.url;
  if (typeof url === 'string') {
    const m = /[?&]list=([^&]+)/.exec(url);
    if (m?.[1]) {
      const raw = decodeURIComponent(m[1]);
      if (!isYoutubeVideoId(raw) && !raw.startsWith('RD')) {
        return raw;
      }
    }
  }
  return null;
}

function mapFullEntry(entry: Record<string, unknown>): TrackMetadata {
  const id = entry.id;
  const trackId = typeof id === 'string' ? id : '';
  const title = typeof entry.title === 'string' ? entry.title : '';
  return {
    trackId,
    title,
    artist: pickArtist(entry),
    thumbnailUrl: pickThumbnail(entry),
    duration: parseDuration(entry.duration),
  };
}

export class YtdlpService {
  private readonly bundleInflight = new Map<string, Promise<SearchBundle>>();
  private readonly bundleRefresh = new Map<string, Promise<void>>();
  private readonly albumSearchInflight = new Map<string, Promise<AlbumSearchHit[]>>();
  private readonly albumSearchRefresh = new Map<string, Promise<void>>();
  private readonly metadataInflight = new Map<string, Promise<TrackMetadata>>();
  private readonly metadataRefresh = new Map<string, Promise<void>>();

  async searchAlbums(query: string): Promise<AlbumSearchHit[]> {
    const q = query.trim();
    if (!q) {
      return [];
    }
    return redisGetSWR<AlbumSearchHit[]>(
      `albums:v2:${q}`,
      CACHE_TTL_SEC,
      undefined,
      async () => {
        const stdout = await runYtdlpFlat(`ytsearch20:${q} full album`, 20);
        const entries = parseJsonLines(stdout);
        const qn = normText(q);
        const rows: AlbumSearchHit[] = [];
        const seen = new Set<string>();

        for (const entry of entries) {
          const id = entry.id;
          if (typeof id !== 'string' || !id || seen.has(id)) {
            continue;
          }
          const titleRaw = typeof entry.title === 'string' ? entry.title : '';
          const duration = parseDuration(entry.duration);
          const titleHasAlbum = /album/i.test(titleRaw);
          if (!titleHasAlbum && duration <= 1800) {
            continue;
          }
          seen.add(id);
          rows.push({
            trackId: id,
            title: cleanAlbumSearchTitle(titleRaw),
            artist: pickChannelOrUploader(entry),
            thumbnailUrl: pickThumbnail(entry),
            duration,
            itemCount: pickPlaylistCount(entry),
          });
        }

        rows.sort((a, b) => {
          const aArtistMatch = qn && normText(a.artist).includes(qn) ? 0 : 1;
          const bArtistMatch = qn && normText(b.artist).includes(qn) ? 0 : 1;
          return aArtistMatch - bArtistMatch;
        });

        return rows;
      },
      this.albumSearchInflight,
      this.albumSearchRefresh,
    );
  }

  async searchStreaming(query: string, onPhase: (p: SearchWorkerPhase) => void): Promise<SearchBundle> {
    const q = query.trim();
    if (!q) {
      const empty: SearchBundle = { tracks: [], albums: [], artists: [] };
      onPhase({ phase: 'meta', query: q });
      onPhase({ phase: 'tracks', partial: true, items: [] });
      onPhase({ phase: 'tracks', partial: false, items: [] });
      onPhase({ phase: 'albums', items: [] });
      onPhase({ phase: 'artists', items: [] });
      onPhase({ phase: 'bundle', bundle: empty });
      return empty;
    }

    const pool = requirePythonPool();
    let built: SearchBundle = { tracks: [], albums: [], artists: [] };

    await pool.callStream('search_bundle_stream', { query: q }, (raw) => {
      const d = raw as Record<string, unknown>;
      const phase = d.phase as string;
      if (phase === 'meta') {
        onPhase({ phase: 'meta', query: String(d.query ?? q) });
        return;
      }
      if (phase === 'tracks') {
        const items = (d.items as SearchResult[]) ?? [];
        const partial = Boolean(d.partial);
        onPhase({ phase: 'tracks', partial, items });
        if (partial) {
          built = { ...built, tracks: [...items] };
        } else {
          built = { ...built, tracks: [...built.tracks, ...items] };
        }
        return;
      }
      if (phase === 'albums') {
        const items = (d.items as SearchAlbumDto[]) ?? [];
        built = { ...built, albums: items };
        onPhase({ phase: 'albums', items });
        return;
      }
      if (phase === 'artists') {
        const items = (d.items as SearchArtistDto[]) ?? [];
        built = { ...built, artists: items };
        onPhase({ phase: 'artists', items });
        return;
      }
      if (phase === 'bundle') {
        const b = d.bundle as SearchBundle | undefined;
        if (b) {
          built = b;
          onPhase({ phase: 'bundle', bundle: b });
        }
      }
    });

    return built;
  }

  async search(query: string): Promise<SearchBundle> {
    const q = query.trim();
    if (!q) {
      return { tracks: [], albums: [], artists: [] };
    }
    return redisGetSWR<SearchBundle>(
      `search:bundle:v10:${q}`,
      CACHE_TTL_SEC,
      undefined,
      async () => {
        const stdoutMain = await runYtdlpFlat(`ytsearch25:${q}`, 25);
        const entries = parseJsonLines(stdoutMain);
        const tracks: SearchResult[] = [];
        const seen = new Set<string>();
        for (const entry of entries) {
          const id = entry.id;
          if (typeof id !== 'string' || !isYoutubeVideoId(id) || seen.has(id)) {
            continue;
          }
          seen.add(id);
          tracks.push({
            trackId: id,
            title: typeof entry.title === 'string' ? entry.title : '',
            artist: pickArtist(entry),
            thumbnailUrl: pickThumbnail(entry),
            duration: parseDuration(entry.duration),
          });
          if (tracks.length >= 40) {
            break;
          }
        }
        return { tracks, albums: [], artists: [] };
      },
      this.bundleInflight,
      this.bundleRefresh,
    );
  }

  async getArtistPage(channelIdParam: string | null, nameHint: string): Promise<ArtistPageDto | null> {
    const resolved = await resolveChannelFromHint(channelIdParam, nameHint);
    if (!resolved) {
      return null;
    }
    const { channelId } = resolved;
    let displayName = resolved.name;
    let thumbnailUrl = resolved.thumbnailUrl;
    const overrideName = nameHint.trim();

    const redis = getRedis();
    const cacheKey = `artist:page:v2:${channelId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const dto = JSON.parse(cached) as ArtistPageDto;
        if (overrideName) {
          return { ...dto, name: overrideName };
        }
        return dto;
      } catch {
        await redis.del(cacheKey);
      }
    }

    if (channelIdParam && isYoutubeChannelId(channelIdParam) && overrideName) {
      displayName = overrideName;
    }

    const playlistEnd = 90;
    const videosUrl = `https://www.youtube.com/channel/${channelId}/videos`;
    const playlistsUrl = `https://www.youtube.com/channel/${channelId}/playlists`;

    let videosResult = '';
    let playlistsResult = '';
    let extrasResult: { subscribers: number | null; description: string | null } = { subscribers: null, description: null };

    [videosResult, playlistsResult, extrasResult] = await Promise.all([
      runYtdlpFlat(videosUrl, playlistEnd).catch(() => ''),
      runYtdlpFlat(playlistsUrl, playlistEnd).catch(() => ''),
      fetchChannelExtras(channelId).catch(() => ({ subscribers: null, description: null })),
    ]);

    const stdoutVideos = videosResult;
    const stdoutPl = playlistsResult;
    const extras = extrasResult;

    const videoEntries = stdoutVideos.trim() ? parseJsonLines(stdoutVideos) : [];
    if ((!displayName || displayName === 'Исполнитель') && videoEntries.length > 0) {
      const fromVid = stripTopicSuffix(pickArtist(videoEntries[0]));
      if (fromVid) {
        displayName = fromVid;
      }
    }
    const topTracks = rankArtistTrackEntries(videoEntries, displayName, 120);
    if (!thumbnailUrl && topTracks.length > 0) {
      thumbnailUrl = topTracks[0].thumbnailUrl;
    }
    if (!thumbnailUrl && videoEntries.length > 0) {
      thumbnailUrl = pickThumbnail(videoEntries[0]) || pickChannelThumbnail(videoEntries[0]);
    }

    const plEntries = stdoutPl.trim() ? parseJsonLines(stdoutPl) : [];
    const albums = rankChannelAlbums(plEntries, displayName, 60);

    const dto: ArtistPageDto = {
      channelId,
      name: displayName,
      thumbnailUrl,
      subscriberCount: extras.subscribers,
      description: extras.description,
      topTracks,
      albums,
    };

    await redis.set(cacheKey, JSON.stringify(dto), 'EX', CACHE_TTL_SEC);

    if (overrideName && channelIdParam && isYoutubeChannelId(channelIdParam)) {
      return { ...dto, name: overrideName };
    }
    return dto;
  }

  async getStreamUrl(trackId: string, opts?: { forceRefresh?: boolean }): Promise<string> {
    const id = trackId.trim();
    if (!id) {
      throw new Error('trackId is required');
    }

    const redis = getRedis();
    const cacheKey = `stream:${id}`;
    if (!opts?.forceRefresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const stdout = await runYtdlp([
          '-f', 'bestaudio',
          '--get-url',
          `https://www.youtube.com/watch?v=${id}`,
        ]);
        const url = stdout.trim().split('\n')[0]?.trim() ?? '';
        if (!url) {
          throw new Error('Empty stream URL from yt-dlp');
        }
        await redis.set(cacheKey, url, 'EX', STREAM_TTL_SEC);
        return url;
      } catch (err) {
        lastError = err as Error;
        const message = lastError.message.toLowerCase();
        const is429 = message.includes('429') || message.includes('too many requests');
        const isBotBlock = message.includes('sign in to confirm') || message.includes('bot');

        if ((is429 || isBotBlock) && attempt < maxAttempts - 1) {
          const delay = STREAM_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Failed to get stream URL after retries');
  }

  async getMetadata(trackId: string): Promise<TrackMetadata> {
    const id = trackId.trim();
    if (!id) {
      throw new Error('trackId is required');
    }
    return redisGetSWR<TrackMetadata>(
      `track:meta:v1:${id}`,
      META_TTL_SEC,
      undefined,
      async () => {
        const stdout = await runYtdlp(['--dump-json', `https://www.youtube.com/watch?v=${id}`]);
        const entry = JSON.parse(stdout.trim()) as Record<string, unknown>;
        return mapFullEntry(entry);
      },
      this.metadataInflight,
      this.metadataRefresh,
    );
  }
}

export const ytdlpService = new YtdlpService();