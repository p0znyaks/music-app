import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { searchRouter } from '../src/routes/search.routes';

process.env.PYTHON_WORKERS = '0';

const { mockYtMusicService, mockYtdlpService } = vi.hoisted(() => {
  const mockYtMusicService = {
    searchAlbums: vi.fn(),
    searchArtists: vi.fn(),
    getAlbum: vi.fn(),
    getArtist: vi.fn(),
  };
  const mockYtdlpService = {
    search: vi.fn(),
    searchStreaming: vi.fn(),
  };
  return { mockYtMusicService, mockYtdlpService };
});

vi.mock('../src/services/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  }),
}));

vi.mock('../src/services/ytmusic.service', () => ({
  ytmusicService: mockYtMusicService,
}));

vi.mock('../src/services/ytdlp.service', () => ({
  ytdlpService: mockYtdlpService,
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', searchRouter);
  return app;
}

describe('GET /api/search/albums', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when q is missing', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/search/albums');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Query parameter q is required');
  });

  it('returns 400 when q is empty', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/search/albums').query({ q: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Query parameter q is required');
  });

  it('returns albums from ytmusicService', async () => {
    mockYtMusicService.searchAlbums.mockResolvedValue([{ browseId: 'album1', title: 'Great Album' }]);
    const app = makeApp();
    const res = await request(app).get('/api/search/albums').query({ q: 'rock' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Great Album');
    expect(mockYtMusicService.searchAlbums).toHaveBeenCalledWith('rock');
  });

  it('returns 502 when ytmusicService throws', async () => {
    mockYtMusicService.searchAlbums.mockRejectedValue(new Error('fail'));
    const app = makeApp();
    const res = await request(app).get('/api/search/albums').query({ q: 'rock' });
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Album search failed');
  });

  it('sets Cache-Control header', async () => {
    mockYtMusicService.searchAlbums.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).get('/api/search/albums').query({ q: 'pop' });
    expect(res.headers['cache-control']).toBeTruthy();
  });
});

describe('GET /api/search/artists', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when q is missing', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/search/artists');
    expect(res.status).toBe(400);
  });

  it('returns artists from ytmusicService', async () => {
    mockYtMusicService.searchArtists.mockResolvedValue([{ browseId: 'artist1', artist: 'Cool Band' }]);
    const app = makeApp();
    const res = await request(app).get('/api/search/artists').query({ q: 'rock' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].artist).toBe('Cool Band');
  });

  it('returns 502 when ytmusicService throws', async () => {
    mockYtMusicService.searchArtists.mockRejectedValue(new Error('fail'));
    const app = makeApp();
    const res = await request(app).get('/api/search/artists').query({ q: 'pop' });
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Artist search failed');
  });
});

describe('GET /api/albums/:browseId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when browseId is empty', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/albums/   ');
    expect([400, 404]).toContain(res.status);
  });

  it('returns album data', async () => {
    mockYtMusicService.getAlbum.mockResolvedValue({ browseId: 'album123', title: 'My Album' });
    const app = makeApp();
    const res = await request(app).get('/api/albums/album123');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Album');
  });

  it('returns 404 when album not found', async () => {
    mockYtMusicService.getAlbum.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/albums/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Album not found');
  });

  it('returns 502 on error', async () => {
    mockYtMusicService.getAlbum.mockRejectedValue(new Error('fail'));
    const app = makeApp();
    const res = await request(app).get('/api/albums/album123');
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Failed to load album');
  });
});

describe('GET /api/artists/:browseId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when browseId is empty', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/artists/   ');
    expect([400, 404]).toContain(res.status);
  });

  it('returns artist data', async () => {
    mockYtMusicService.getArtist.mockResolvedValue({ browseId: 'artist123', name: 'Cool Band' });
    const app = makeApp();
    const res = await request(app).get('/api/artists/artist123');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cool Band');
  });

  it('returns 404 when artist not found', async () => {
    mockYtMusicService.getArtist.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/artists/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Artist not found');
  });
});

describe('GET /api/search - main search', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when q is missing', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Query parameter q is required');
  });

  it('returns 400 when q is empty', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/search').query({ q: '' });
    expect(res.status).toBe(400);
  });

  it('returns JSON bundle for non-NDJSON Accept header', async () => {
    mockYtdlpService.search.mockResolvedValue({
      tracks: [{ trackId: 't1', title: 'Test Track', artist: 'Artist' }],
      albums: [],
      artists: [],
    });
    const app = makeApp();
    const res = await request(app)
      .get('/api/search')
      .query({ q: 'test song' })
      .set('Accept', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.tracks).toBeDefined();
    expect(res.body.albums).toBeDefined();
  });

  it('returns 502 on ytdlpService error (JSON)', async () => {
    mockYtdlpService.search.mockRejectedValue(new Error('fail'));
    const app = makeApp();
    const res = await request(app).get('/api/search').query({ q: 'rock' });
    expect(res.status).toBe(502);
    expect(res.body.message).toBe('Search failed');
  });
});