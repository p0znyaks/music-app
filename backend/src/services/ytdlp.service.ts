import { AsyncSemaphore, envInt } from "../env";
import { createLogger } from "../logger";
import { spawn } from "child_process";
import { redisGetSWR, stringifyEnvelope } from "./cache-swr";
import { getPythonPool } from "./python-pool";
import { getRedis } from "./redis";
import { normalizeDuration } from "./track-media.service";
import {
  innertubeSearchBreaker,
  innertubeStreamBreaker,
} from "./upstream-breaker";

const log = createLogger("ytdlp");

const CACHE_TTL_SEC = envInt("REDIS_TTL_YTDLP_SEC", 86400);
const META_TTL_SEC = envInt("REDIS_TTL_YTDLP_META_SEC", CACHE_TTL_SEC);
// googlevideo URLs carry their own `expire` param and live ~6h, so a longer
// TTL only serves stale links that make the player hit 403 and re-resolve.
const STREAM_TTL_SEC = envInt("REDIS_TTL_STREAM_SEC", 18000);
const STREAM_RETRY_DELAY_MS = 2000;
// Kept in sync with MAX_TRACKS_OUT in scripts/ytmusic_worker.py, which caps
// the number of tracks the search endpoints return.
const MAX_SEARCH_TRACKS = 36;

interface PlayerStreamResult {
  ok: boolean;
  url?: string;
  client?: string;
  error?: string;
  title?: string;
  author?: string;
  lengthSeconds?: number;
}
// Refresh a stream link before it actually expires so playback never stalls.
const STREAM_SOFT_TTL_MS = (): number => {
  const raw = process.env.REDIS_SWR_STREAM_SOFT_MS;
  if (!raw) {
    return 3 * 60 * 60 * 1000;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 3 * 60 * 60 * 1000;
};

export interface SearchResult {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number | string;
  channelId?: string;
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

export interface TrackMetadata {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  duration: number;
}

/**
 * YouTube itself refused to serve this track (region lock, removed video,
 * age gate, private/deleted). Retrying cannot help, so the API reports it as
 * 404 and the client skips to the next queue item instead of spinning forever.
 */
export class TrackUnavailableError extends Error {
  constructor(
    readonly trackId: string,
    readonly reason: string,
  ) {
    super(`Track ${trackId} is unavailable: ${reason}`);
    this.name = "TrackUnavailableError";
  }
}

/** playabilityStatus values that will never resolve into a playable stream. */
const PERMANENT_PLAYABILITY_RE =
  /VIDEO_UNAVAILABLE|UNPLAYABLE|LOGIN_REQUIRED|AGE_VERIFICATION_REQUIRED|PRIVATE|AGE_CHECK_REQUIRED|PAYLOAD_REQUIRED/;

function isPermanentPlayabilityFailure(error: string): boolean {
  return PERMANENT_PLAYABILITY_RE.test(error);
}

function ytdlpBinary(): string {
  return process.env.YTDLP_PATH?.trim() || "yt-dlp";
}

function ytdlpCookieFlags(): string[] {
  const browser = process.env.YTDLP_COOKIES_BROWSER?.trim();
  if (!browser) {
    const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
    if (cookiesFile) {
      return ["--cookies", cookiesFile];
    }
    return [];
  }
  const configPath = process.env.YTDLP_BROWSER_CONFIG_PATH?.trim();
  if (configPath) {
    return ["--cookies-from-browser", browser, configPath];
  }
  return ["--cookies-from-browser", browser];
}

/**
 * Hard deadline for a yt-dlp invocation.
 *
 * Without one a stuck process (bot-check page, dead connection) holds the HTTP
 * request open indefinitely, so the player spins forever instead of falling
 * back. yt-dlp already retries internally for a while, which is why this is
 * generous compared to the InnerTube budget.
 */
const YTDLP_TIMEOUT_MS = envInt("YTDLP_TIMEOUT_MS", 20000);

/**
 * Caps how many yt-dlp processes may run at once.
 *
 * yt-dlp is the fallback, so it is exactly when a burst is most likely; without
 * a cap, N concurrent searches would spawn N Chromium-sized processes and
 * starve the rest of the container. Beyond the cap callers queue instead.
 */
const ytdlpLimiter = new AsyncSemaphore(envInt("YTDLP_CONCURRENCY", 3));

function runYtdlp(args: string[]): Promise<string> {
  return ytdlpLimiter.use(() => spawnYtdlp(args));
}

function spawnYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = ytdlpBinary();
    const allArgs = [...ytdlpCookieFlags(), ...args];
    const proc = spawn(bin, allArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      proc.kill("SIGKILL");
      reject(new Error(`yt-dlp timed out after ${YTDLP_TIMEOUT_MS}ms`));
    }, YTDLP_TIMEOUT_MS);

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    proc.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    proc.on("error", (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
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
    throw new Error(
      "Python worker pool is not available (set PYTHON_WORKERS>=1)",
    );
  }
  return pool;
}

async function runYtdlpFlat(url: string, playlistEnd: number): Promise<string> {
  return runYtdlp([
    url,
    "--dump-json",
    "--flat-playlist",
    "--playlist-end",
    String(playlistEnd),
    "--no-download",
  ]);
}

function pickThumbnail(entry: Record<string, unknown>): string {
  if (typeof entry.thumbnail === "string" && entry.thumbnail) {
    return entry.thumbnail;
  }
  const thumbs = entry.thumbnails;
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    const first = thumbs[0] as Record<string, unknown>;
    if (typeof first.url === "string") {
      return first.url;
    }
  }
  return "";
}

function pickArtist(entry: Record<string, unknown>): string {
  const a = entry.artist;
  if (typeof a === "string" && a) {
    return a;
  }
  const u = entry.uploader;
  if (typeof u === "string" && u) {
    return u;
  }
  const c = entry.channel;
  if (typeof c === "string" && c) {
    return c;
  }
  return "";
}

function parseJsonLines(stdout: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const line of stdout.split("\n")) {
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

function isYoutubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

function mapFullEntry(entry: Record<string, unknown>): TrackMetadata {
  const id = entry.id;
  const trackId = typeof id === "string" ? id : "";
  const title = typeof entry.title === "string" ? entry.title : "";
  return {
    trackId,
    title,
    artist: pickArtist(entry),
    thumbnailUrl: pickThumbnail(entry),
    duration: normalizeDuration(entry.duration) ?? 0,
  };
}

/**
 * Canonical form of a search query for cache keys.
 *
 * YouTube treats "Rihanna", "rihanna" and "  Rihanna   " as the same search,
 * so without this every casing and whitespace variation became a separate
 * upstream request on top of a separate cache entry.
 */
function normalizeQueryForCache(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export class YtdlpService {
  private readonly bundleInflight = new Map<string, Promise<SearchBundle>>();
  private readonly bundleRefresh = new Map<string, Promise<void>>();
  private readonly metadataInflight = new Map<string, Promise<TrackMetadata>>();
  private readonly metadataRefresh = new Map<string, Promise<void>>();
  private readonly streamInflight = new Map<string, Promise<string>>();
  private readonly streamRefresh = new Map<string, Promise<void>>();

  async search(query: string): Promise<SearchBundle> {
    const q = normalizeQueryForCache(query);
    if (!q) {
      return { tracks: [], albums: [], artists: [] };
    }
    return redisGetSWR<SearchBundle>(
      `search:bundle:v10:${q}`,
      CACHE_TTL_SEC,
      undefined,
      () => this.buildSearchBundle(q),
      this.bundleInflight,
      this.bundleRefresh,
    );
  }

  /**
   * InnerTube first (the JSON API behind the official YouTube Music player):
   * one round-trip per result kind instead of yt-dlp having to scrape and
   * parse a YouTube results page. yt-dlp stays as the fallback for when
   * InnerTube rate-limits us.
   */
  private async buildSearchBundle(q: string): Promise<SearchBundle> {
    // While InnerTube is failing, going straight to yt-dlp costs about the same
    // as one dead InnerTube attempt plus the yt-dlp call, and the user gets
    // songs either way instead of an empty page.
    if (!innertubeSearchBreaker.isOpen()) {
      try {
        const pool = requirePythonPool();
        const bundle = await pool.call<SearchBundle>("search_bundle", {
          query: q,
        });
        if (bundle?.tracks?.length) {
          innertubeSearchBreaker.onSuccess();
          // The client renders tracks from this bundle but loads albums and
          // artists through their own endpoints, so we only need the tracks
          // here and leave the latency of the extra InnerTube calls behind.
          return { tracks: bundle.tracks, albums: [], artists: [] };
        }
        innertubeSearchBreaker.onFailure(`no tracks for "${q}"`);
      } catch (err) {
        innertubeSearchBreaker.onFailure(String(err));
        log.warn(
          `InnerTube bundle failed for "${q}", falling back to yt-dlp:`,
          err,
        );
      }
    }

    const stdoutMain = await runYtdlpFlat(`ytsearch25:${q}`, 25);
    const tracks: SearchResult[] = [];
    const seen = new Set<string>();
    for (const entry of parseJsonLines(stdoutMain)) {
      const id = entry.id;
      if (typeof id !== "string" || !isYoutubeVideoId(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      tracks.push({
        trackId: id,
        title: typeof entry.title === "string" ? entry.title : "",
        artist: pickArtist(entry),
        thumbnailUrl: pickThumbnail(entry),
        duration: normalizeDuration(entry.duration) ?? 0,
      });
      if (tracks.length >= MAX_SEARCH_TRACKS) {
        break;
      }
    }
    return { tracks, albums: [], artists: [] };
  }

  async getStreamUrl(
    trackId: string,
    opts?: { forceRefresh?: boolean },
  ): Promise<string> {
    const id = trackId.trim();
    if (!id) {
      throw new Error("trackId is required");
    }

    const cacheKey = `stream:${id}`;

    // A stale-but-working link is far better than a re-resolve: the player can
    // start instantly and the refresh happens in the background.
    if (opts?.forceRefresh) {
      const running = this.streamInflight.get(cacheKey);
      if (running) {
        return running;
      }
      const req = this.fetchStreamUrl(id, cacheKey).finally(() => {
        this.streamInflight.delete(cacheKey);
      });
      this.streamInflight.set(cacheKey, req);
      return req;
    }

    return redisGetSWR<string>(
      cacheKey,
      STREAM_TTL_SEC,
      STREAM_SOFT_TTL_MS(),
      () => this.fetchStreamUrl(id, cacheKey),
      this.streamInflight,
      this.streamRefresh,
    );
  }

  private async fetchStreamUrl(id: string, cacheKey: string): Promise<string> {
    const redis = getRedis();

    // yt-dlp resolves the download URL first. The InnerTube player API is much
    // faster, but the URLs it returns from the ANDROID/IOS clients only serve
    // one-byte range requests: a real playback of such a URL is answered with
    // 403. yt-dlp negotiates a web-client URL that streams in full, so it is
    // the correct primary source here.
    try {
      return await this.fetchStreamUrlWithYtdlp(id, cacheKey);
    } catch (err) {
      if (err instanceof TrackUnavailableError) {
        throw err;
      }
      log.warn(`yt-dlp failed for ${id}, trying InnerTube:`, err);
    }

    const result = await this.fetchStreamUrlWithInnerTube(id);
    await redis.set(cacheKey, stringifyEnvelope(result), "EX", STREAM_TTL_SEC);
    return result;
  }

  /**
   * Resolve a stream URL through YouTube Music's own InnerTube player API.
   * Kept as a fallback: it is fast and its playability verdict is precise, but
   * the URLs it returns are not usable for a full streaming request.
   */
  private async fetchStreamUrlWithInnerTube(id: string): Promise<string> {
    if (innertubeStreamBreaker.isOpen()) {
      throw new Error("InnerTube bypassed by breaker");
    }
    const pool = getPythonPool();
    if (!pool) {
      throw new Error("python pool unavailable");
    }
    const result = await pool.call<PlayerStreamResult>("get_player_stream", {
      videoId: id,
    });
    if (
      result?.ok &&
      typeof result.url === "string" &&
      result.url.startsWith("http")
    ) {
      innertubeStreamBreaker.onSuccess();
      return result.url;
    }
    const reason = result?.error ?? "no url";
    innertubeStreamBreaker.onFailure(reason);
    log.warn(`InnerTube unavailable for ${id}: ${reason}`);
    // A hard playabilityStatus verdict will not change on retry, and yt-dlp
    // would only pay the same blocked answer again — fail fast so the client
    // can skip this track.
    if (result && !result.ok && isPermanentPlayabilityFailure(reason)) {
      throw new TrackUnavailableError(id, reason);
    }
    throw new Error(`InnerTube: ${reason}`);
  }

  private async fetchStreamUrlWithYtdlp(
    id: string,
    cacheKey: string,
  ): Promise<string> {
    const redis = getRedis();
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const stdout = await runYtdlp([
          // m4a keeps the cached file and the disk fast-path consistent: the
          // nginx and controller paths both serve it as audio/mp4.
          "-f",
          "bestaudio[ext=m4a]/bestaudio",
          "--get-url",
          `https://www.youtube.com/watch?v=${id}`,
        ]);
        const url = stdout.trim().split("\n")[0]?.trim() ?? "";
        if (!url) {
          throw new Error("Empty stream URL from yt-dlp");
        }
        await redis.set(cacheKey, stringifyEnvelope(url), "EX", STREAM_TTL_SEC);
        return url;
      } catch (err) {
        lastError = err as Error;
        const message = lastError.message.toLowerCase();
        const is429 =
          message.includes("429") || message.includes("too many requests");
        const isBotBlock =
          message.includes("sign in to confirm") || message.includes("bot");

        if ((is429 || isBotBlock) && attempt < maxAttempts - 1) {
          const delay = STREAM_RETRY_DELAY_MS * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error("Failed to get stream URL after retries");
  }

  /**
   * Downloads the best audio-only format into `outBase` and resolves with the
   * path of the produced file. Used by the on-disk audio cache, which must not
   * depend on the (single-use) googlevideo URL.
   */
  async getMetadata(trackId: string): Promise<TrackMetadata> {
    const id = trackId.trim();
    if (!id) {
      throw new Error("trackId is required");
    }
    return redisGetSWR<TrackMetadata>(
      `track:meta:v1:${id}`,
      META_TTL_SEC,
      undefined,
      async () => {
        const stdout = await runYtdlp([
          "--dump-json",
          `https://www.youtube.com/watch?v=${id}`,
        ]);
        const entry = JSON.parse(stdout.trim()) as Record<string, unknown>;
        return mapFullEntry(entry);
      },
      this.metadataInflight,
      this.metadataRefresh,
    );
  }
}

export const ytdlpService = new YtdlpService();
