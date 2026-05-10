import { Request, Response } from 'express';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { UserMixPreferences } from '../entities/user-mix-preferences.entity';
import { getRedis } from '../redis.client';
import { ytdlpService } from '../services/ytdlp.service';

type TimeSlot = 'утро' | 'день' | 'вечер' | 'ночь';

type SlotPreferences = {
  genres: string[];
  tags: string[];
};

type MixPreferencesPayload = Record<TimeSlot, SlotPreferences>;

type MixTrack = {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration?: number | null;
  score: number;
  tags: string[];
  source: 'history' | 'favorite' | 'playlist' | 'ytm';
};

const TOP_GENRES = [
  'pop', 'rock', 'hip hop', 'rap', 'r&b', 'indie', 'indie pop', 'dance', 'electronic', 'house',
  'techno', 'trance', 'drum and bass', 'dubstep', 'ambient', 'chill', 'lofi', 'jazz', 'blues', 'funk',
  'soul', 'disco', 'country', 'folk', 'acoustic', 'classical', 'orchestral', 'soundtrack', 'metal', 'hard rock',
  'punk', 'alternative', 'grunge', 'k-pop', 'j-pop', 'latin', 'reggaeton', 'afrobeats', 'phonk', 'synthwave',
  'new wave', 'edm', 'deep house', 'future bass', 'trap', 'emo', 'dream pop', 'post rock', 'gospel', 'chanson',
];

const DEFAULT_SLOT_PREFS: MixPreferencesPayload = {
  утро: { genres: ['acoustic', 'chill', 'indie pop'], tags: ['спокойное', 'acoustic', 'chill', 'morning'] },
  день: { genres: ['pop', 'rock', 'house'], tags: ['энергичное', 'upbeat', 'pop', 'rock'] },
  вечер: { genres: ['dance', 'electronic', 'hip hop'], tags: ['драйвовое', 'energetic', 'dance', 'hype'] },
  ночь: { genres: ['ambient', 'lofi', 'dream pop'], tags: ['грусть', 'ambient', 'slow', 'sleep'] },
};

const SLOT_HINTS: Record<TimeSlot, string> = {
  утро: 'Утро — спокойные, акустичные и чилловые треки',
  день: 'День — энергичный поп и рок',
  вечер: 'Вечер — драйв, танцы и хайп',
  ночь: 'Ночь — мягкий эмбиент и медленные треки для отдыха',
};

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }
  return fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getMskHour(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour');
  return h ? parseInt(h.value, 10) : 0;
}

function slotForHour(h: number): TimeSlot {
  if (h >= 5 && h < 11) return 'утро';
  if (h >= 11 && h < 17) return 'день';
  if (h >= 17 && h < 22) return 'вечер';
  return 'ночь';
}

function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value || value.length > 24 || value.includes('#')) continue;
    const key = norm(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 20) break;
  }
  return out;
}

function sanitizeGenres(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(TOP_GENRES.map(norm));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    if (!value) continue;
    const key = norm(value);
    if (!allowed.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 8) break;
  }
  return out;
}

function sanitizePreferences(input: unknown): MixPreferencesPayload {
  const src = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const mk = (slot: TimeSlot): SlotPreferences => {
    const row = typeof src[slot] === 'object' && src[slot] !== null ? (src[slot] as Record<string, unknown>) : {};
    return {
      genres: sanitizeGenres(row.genres),
      tags: sanitizeTags(row.tags),
    };
  };
  return {
    утро: mk('утро'),
    день: mk('день'),
    вечер: mk('вечер'),
    ночь: mk('ночь'),
  };
}

function effectivePreferences(saved: MixPreferencesPayload | null): MixPreferencesPayload {
  const safe = saved ?? DEFAULT_SLOT_PREFS;
  return {
    утро: {
      genres: safe.утро.genres.length > 0 ? safe.утро.genres : DEFAULT_SLOT_PREFS.утро.genres,
      tags: safe.утро.tags.length > 0 ? safe.утро.tags : DEFAULT_SLOT_PREFS.утро.tags,
    },
    день: {
      genres: safe.день.genres.length > 0 ? safe.день.genres : DEFAULT_SLOT_PREFS.день.genres,
      tags: safe.день.tags.length > 0 ? safe.день.tags : DEFAULT_SLOT_PREFS.день.tags,
    },
    вечер: {
      genres: safe.вечер.genres.length > 0 ? safe.вечер.genres : DEFAULT_SLOT_PREFS.вечер.genres,
      tags: safe.вечер.tags.length > 0 ? safe.вечер.tags : DEFAULT_SLOT_PREFS.вечер.tags,
    },
    ночь: {
      genres: safe.ночь.genres.length > 0 ? safe.ночь.genres : DEFAULT_SLOT_PREFS.ночь.genres,
      tags: safe.ночь.tags.length > 0 ? safe.ночь.tags : DEFAULT_SLOT_PREFS.ночь.tags,
    },
  };
}

function dedupeTagsByLowerCase(tags: string[]): string[] {
  const byLower = new Map<string, string>();
  for (const t of tags) {
    const k = norm(t);
    if (!k || byLower.has(k)) continue;
    byLower.set(k, t);
  }
  return [...byLower.values()];
}

const MIX_CACHE_TTL_SEC = envInt('REDIS_TTL_MIX_SEC', 600);
const MIX_DEFAULT_LIMIT = 20;
const MIX_MAX_LIMIT = 20;
const MIX_MAX_TOTAL = 100;
const MIX_TOP_STABLE = 8;

async function loadSavedPreferences(userId: number): Promise<MixPreferencesPayload | null> {
  const row = await AppDataSource.getRepository(UserMixPreferences).findOne({
    where: { user: { id: userId } },
  });
  if (!row) {
    return null;
  }
  return sanitizePreferences(row.slots);
}

export async function getMixPreferences(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const saved = await loadSavedPreferences(userId);
  return res.json({
    genresCatalog: TOP_GENRES,
    preferences: effectivePreferences(saved),
    hasCustomSettings: saved !== null,
  });
}

export async function putMixPreferences(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const incoming = sanitizePreferences(req.body?.preferences);
  const repo = AppDataSource.getRepository(UserMixPreferences);
  const existing = await repo.findOne({ where: { user: { id: userId } } });
  if (existing) {
    existing.slots = incoming;
    await repo.save(existing);
  } else {
    const created = repo.create({
      user: { id: userId } as any,
      slots: incoming,
    });
    await repo.save(created);
  }
  try {
    const keys = await getRedis().keys(`mix:${userId}:*`);
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
  } catch {
    // ignore cache invalidation issues
  }
  return res.json({ preferences: effectivePreferences(incoming), hasCustomSettings: true });
}

export async function getMix(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const limit = Math.min(parsePositiveInt(req.query.limit, MIX_DEFAULT_LIMIT), MIX_MAX_LIMIT);
  const offset = Math.min(parsePositiveInt(req.query.offset, 0), MIX_MAX_TOTAL);
  const hour = getMskHour();
  const timeOfDay = slotForHour(hour);
  const savedPrefs = await loadSavedPreferences(userId);
  const prefs = effectivePreferences(savedPrefs);
  const activeSlot = prefs[timeOfDay];
  const prefVersion = Buffer.from(JSON.stringify(prefs)).toString('base64').slice(0, 16);
  const cacheKey = `mix:${userId}:${timeOfDay}:${prefVersion}`;
  const forceRefresh = req.query.refresh === '1';

  let fullTracks: MixTrack[] | null = null;
  let fromCache = false;
  let ytmFallbackUsed = false;

  if (!forceRefresh) {
    try {
      const cached = await getRedis().get(cacheKey);
      if (cached) {
        const payload = JSON.parse(cached) as { tracks: MixTrack[]; ytmFallbackUsed?: boolean };
        fullTracks = Array.isArray(payload.tracks) ? payload.tracks.slice(0, MIX_MAX_TOTAL) : [];
        fromCache = true;
        ytmFallbackUsed = Boolean(payload.ytmFallbackUsed);
      }
    } catch {
      // ignore cache read errors
    }
  }

  if (!fullTracks) {
    const [histories, tagRows, favorites, playlistRows] = await Promise.all([
      AppDataSource.getRepository(ListenHistory).find({
        where: { user: { id: userId } },
        order: { listenedAt: 'DESC' },
      }),
      AppDataSource.getRepository(TrackTag).find({ where: { user: { id: userId } } }),
      AppDataSource.getRepository(FavoriteTrack).find({ where: { user: { id: userId } } }),
      AppDataSource.getRepository(PlaylistTrack)
        .createQueryBuilder('pt')
        .innerJoin('pt.playlist', 'p')
        .where('p.user_id = :uid', { uid: userId })
        .orderBy('pt.added_at', 'DESC')
        .getMany(),
    ]);

    const trackTagsMap = new Map<string, string[]>();
    const userTagVocab = new Set<string>();
    for (const row of tagRows) {
      userTagVocab.add(norm(row.tag));
      const list = trackTagsMap.get(row.trackId) ?? [];
      list.push(row.tag);
      trackTagsMap.set(row.trackId, list);
    }

    const listenCount = new Map<string, number>();
    const artistCount = new Map<string, number>();
    const last10TrackIds = new Set<string>();
    const byTrack = new Map<string, MixTrack>();

    for (let i = 0; i < histories.length; i += 1) {
      const h = histories[i]!;
      listenCount.set(h.trackId, (listenCount.get(h.trackId) ?? 0) + 1);
      artistCount.set(h.artist, (artistCount.get(h.artist) ?? 0) + 1);
      if (i < 10) {
        last10TrackIds.add(h.trackId);
      }
      if (!byTrack.has(h.trackId)) {
        byTrack.set(h.trackId, {
          trackId: h.trackId,
          title: h.title,
          artist: h.artist,
          thumbnailUrl: h.thumbnailUrl,
          score: 0,
          tags: [],
          source: 'history',
        });
      }
    }

    for (const row of favorites) {
      if (!byTrack.has(row.trackId)) {
        byTrack.set(row.trackId, {
          trackId: row.trackId,
          title: row.title,
          artist: row.artist,
          thumbnailUrl: row.thumbnailUrl,
          duration: row.duration ?? undefined,
          score: 0,
          tags: [],
          source: 'favorite',
        });
      }
    }
    for (const row of playlistRows) {
      if (!byTrack.has(row.trackId)) {
        byTrack.set(row.trackId, {
          trackId: row.trackId,
          title: row.title,
          artist: row.artist,
          thumbnailUrl: row.thumbnailUrl,
          duration: row.duration ?? undefined,
          score: 0,
          tags: [],
          source: 'playlist',
        });
      }
    }

    if (byTrack.size === 0 && activeSlot.genres.length === 0) {
      return res.status(400).json({ message: 'Not enough source tracks for personal mix' });
    }

    const top10Set = new Set(
      [...listenCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id),
    );
    const top5ArtistSet = new Set(
      [...artistCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => norm(name)),
    );
    const favoriteSet = new Set(favorites.map((f) => f.trackId));
    const playlistSet = new Set(playlistRows.map((p) => p.trackId));
    const preferredTags = activeSlot.tags.map(norm);

    const tracks: MixTrack[] = [];
    for (const track of byTrack.values()) {
      const tags = dedupeTagsByLowerCase(trackTagsMap.get(track.trackId) ?? []);
      let score = 0;
      if (top10Set.has(track.trackId)) score += 3;
      if (top5ArtistSet.has(norm(track.artist))) score += 2;
      if (last10TrackIds.has(track.trackId)) score += 1;
      if (favoriteSet.has(track.trackId)) score += 4;
      if (playlistSet.has(track.trackId)) score += 3;
      if (tags.some((t) => preferredTags.includes(norm(t)))) score += 5;

      let vocabBonus = 0;
      for (const t of tags) {
        if (userTagVocab.has(norm(t))) {
          vocabBonus += 1;
          if (vocabBonus >= 3) break;
        }
      }
      score += Math.min(3, vocabBonus);
      tracks.push({ ...track, score, tags });
    }

    const ytmTracks: MixTrack[] = [];
    const existingIds = new Set(tracks.map((t) => t.trackId));
    if (activeSlot.genres.length > 0 && tracks.length < MIX_MAX_TOTAL) {
      for (const genre of activeSlot.genres.slice(0, 4)) {
        try {
          const bundle = await ytdlpService.search(`${genre} music`);
          const chunk = bundle.tracks.slice(0, 18);
          for (const t of chunk) {
            if (existingIds.has(t.trackId)) continue;
            existingIds.add(t.trackId);
            ytmTracks.push({
              trackId: t.trackId,
              title: t.title,
              artist: t.artist,
              thumbnailUrl: t.thumbnailUrl,
              duration: t.duration ?? undefined,
              score: 2 + Math.random() * 2.5,
              tags: [genre],
              source: 'ytm',
            });
          }
        } catch {
          ytmFallbackUsed = true;
        }
      }
    }

    const merged = [...tracks, ...ytmTracks];
    merged.sort((a, b) => b.score - a.score);
    const head = merged.slice(0, MIX_TOP_STABLE);
    const tail = merged.slice(MIX_TOP_STABLE);
    shuffleInPlace(tail);
    fullTracks = [...head, ...tail].slice(0, MIX_MAX_TOTAL);

    try {
      await getRedis().set(
        cacheKey,
        JSON.stringify({
          tracks: fullTracks,
          ytmFallbackUsed,
        }),
        'EX',
        MIX_CACHE_TTL_SEC,
      );
    } catch {
      // ignore cache write errors
    }
  }

  const end = Math.min(offset + limit, fullTracks.length);
  const pageTracks = offset >= fullTracks.length ? [] : fullTracks.slice(offset, end);
  const hasMore = end < fullTracks.length && end < MIX_MAX_TOTAL;

  return res.json({
    generatedAt: new Date().toISOString(),
    timeOfDay,
    moodHint: SLOT_HINTS[timeOfDay],
    preferredGenres: activeSlot.genres,
    preferredTags: activeSlot.tags,
    tracks: pageTracks,
    fromCache,
    ytmFallbackUsed,
    paging: {
      offset,
      limit,
      total: fullTracks.length,
      hasMore,
      nextOffset: hasMore ? end : null,
    },
  });
}
