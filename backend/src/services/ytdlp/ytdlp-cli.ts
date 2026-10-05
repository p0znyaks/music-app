import { spawn } from 'child_process';
import { AsyncSemaphore, envInt } from '../../env';

/**
 * Hard deadline for a yt-dlp invocation.
 *
 * Without one a stuck process (bot-check page, dead connection) holds the HTTP
 * request open indefinitely, so the player spins forever instead of falling
 * back. yt-dlp already retries internally for a while, which is why this is
 * generous compared to the InnerTube budget.
 */
const YTDLP_TIMEOUT_MS = envInt('YTDLP_TIMEOUT_MS', 20000);

/**
 * Caps how many yt-dlp processes may run at once.
 *
 * yt-dlp is the fallback, so it is exactly when a burst is most likely; without
 * a cap, N concurrent searches would spawn N Chromium-sized processes and
 * starve the rest of the container. Beyond the cap callers queue instead.
 */
const ytdlpLimiter = new AsyncSemaphore(envInt('YTDLP_CONCURRENCY', 3));

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

function spawnYtdlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = ytdlpBinary();
    const allArgs = [...ytdlpCookieFlags(), ...args];
    const proc = spawn(bin, allArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`yt-dlp timed out after ${YTDLP_TIMEOUT_MS}ms`));
    }, YTDLP_TIMEOUT_MS);

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    proc.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    proc.on('error', (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
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

/** Runs yt-dlp with the configured cookies and the shared concurrency cap. */
export function runYtdlp(args: string[]): Promise<string> {
  return ytdlpLimiter.use(() => spawnYtdlp(args));
}

/** `--flat-playlist` listing, used only where InnerTube has no equivalent. */
export function runYtdlpFlat(url: string, playlistEnd: number): Promise<string> {
  return runYtdlp([
    url,
    '--dump-json',
    '--flat-playlist',
    '--playlist-end',
    String(playlistEnd),
    '--no-download',
  ]);
}
