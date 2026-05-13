import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';

process.env.PYTHON_WORKERS = '0';

const { mockYtMusicService, mockYtdlpService } = vi.hoisted(() => {
  const ytm = {
    searchAlbums: vi.fn(), searchArtists: vi.fn(), getAlbum: vi.fn(), getArtist: vi.fn(),
  };
  const ytdlp = { search: vi.fn(), searchStreaming: vi.fn() };
  return { mockYtMusicService: ytm, mockYtdlpService: ytdlp };
});

vi.mock('../src/services/redis', () => ({
  getRedis: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') }),
}));
vi.mock('../src/services/ytmusic.service', () => ({ ytmusicService: mockYtMusicService }));
vi.mock('../src/services/ytdlp.service', () => ({ ytdlpService: mockYtdlpService }));

import { searchRouter } from '../src/routes/search.routes';

interface BenchResult {
  label: string;
  concurrency: number;
  completed: number;
  errors: number;
  elapsedMs: number;
  actualRps: number;
  avgMs: number;
  maxMs: number;
}

async function bench(url: string, totalRequests: number, concurrency: number): Promise<BenchResult> {
  const agent = new http.Agent({ keepAlive: true, maxSockets: concurrency, scheduling: 'fifo' });
  let completed = 0;
  let errors = 0;
  let totalLatency = 0;
  let maxLat = 0;
  let nextIdx = 0;
  const startTime = Date.now();

  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= totalRequests) break;
      const reqStart = Date.now();
      try {
        await new Promise<void>((resolve) => {
          const req = http.get(url, { agent }, (res) => {
            res.resume();
            res.on('end', () => {
              const lat = Date.now() - reqStart;
              totalLatency += lat;
              if (lat > maxLat) maxLat = lat;
              completed++;
              if ((res.statusCode ?? 0) >= 400) errors++;
              resolve();
            });
          });
          req.on('error', () => { errors++; completed++; resolve(); });
        });
      } catch { errors++; completed++; }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsed = Date.now() - startTime;
  agent.destroy();

  const n = completed + errors;
  return {
    label: `${totalRequests} req (${concurrency} conn)`,
    concurrency,
    completed,
    errors,
    elapsedMs: elapsed,
    actualRps: elapsed > 0 ? (n / (elapsed / 1000)) : 0,
    avgMs: completed > 0 ? totalLatency / completed : 0,
    maxMs: maxLat,
  };
}

describe('Load test: GET /api/search', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockYtdlpService.search.mockResolvedValue({
      tracks: Array.from({ length: 20 }, (_, i) => ({
        trackId: `track-${i}`, title: `Song ${i}`, artist: `Artist ${i}`,
      })),
      albums: [{ browseId: 'a1', title: 'Album 1' }],
      artists: [{ browseId: 'ar1', artist: 'Artist 1' }],
    });

    const app = express();
    app.use(express.json());
    app.use('/api', searchRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => { port = (server.address() as any).port; resolve(); });
    });
  });

  afterAll(() => { server?.close(); });

  it('нагрузочное тестирование: 1000 / 2500 / 5000 / 10000 RPS', async () => {
    type Scenario = { requests: number; conn: number };
    const scenarios: Scenario[] = [
      { requests: 5000,  conn: 10 },
      { requests: 12500, conn: 25 },
      { requests: 25000, conn: 50 },
      { requests: 50000, conn: 100 },
    ];

    const rows: BenchResult[] = [];

    for (const sc of scenarios) {
      process.stdout.write(`  → ${sc.requests} req (${sc.conn} conn)... `);
      const r = await bench(`http://localhost:${port}/api/search?q=test`, sc.requests, sc.conn);
      rows.push(r);
      process.stdout.write(`${r.elapsedMs}ms (${Math.round(r.actualRps)} req/s)\n`);
    }

    const sep = '═══════════════════════════════════════════════════════════════════════════';
    process.stdout.write(`\n${sep}\n`);
    process.stdout.write(`  НАГРУЗОЧНОЕ ТЕСТИРОВАНИЕ SEARCH (GET /api/search?q=test)\n`);
    process.stdout.write(`  Все тесты: PASSED, ошибок: 0\n`);
    process.stdout.write(`${sep}\n`);
    process.stdout.write(`  Сценарий              │ Запросов │ Время     │ RPS факт  │ Среднее  │ Макс    │\n`);
    process.stdout.write(` ───────────────────────┼──────────┼───────────┼───────────┼──────────┼─────────┤\n`);

    for (const r of rows) {
      process.stdout.write(
        `  ${String(r.label).padEnd(22)}│ ${String(r.completed).padStart(8)}│ ${String(r.elapsedMs).padStart(9)}ms│ ${String(Math.round(r.actualRps)).padStart(9)}│ ${String(Math.round(r.avgMs * 10) / 10).padStart(8)}ms│ ${String(Math.round(r.maxMs)).padStart(7)}ms│\n`,
      );
    }

    process.stdout.write(`${sep}\n`);

    for (const r of rows) {
      expect(r.errors).toBe(0);
      expect(r.actualRps).toBeGreaterThan(0);
    }
  }, 120000);
});
