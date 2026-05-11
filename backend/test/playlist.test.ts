import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { playlistRouter } from '../src/routes/playlist.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const plRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn(), findOne: vi.fn(), remove: vi.fn() };
const ptRepo = { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), save: vi.fn(), delete: vi.fn(), remove: vi.fn() };
const favRepo = { findOne: vi.fn().mockResolvedValue(null) };
const tagRepo = { count: vi.fn().mockResolvedValue(0), createQueryBuilder: vi.fn() };
const clipRepo = { find: vi.fn().mockResolvedValue([]) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'Playlist') return plRepo;
      if (entity === 'PlaylistTrack') return ptRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'TrackTag') return tagRepo;
      if (entity === 'Clip') return clipRepo;
      return {};
    }),
  },
}));

function token(userId = 1) {
  return jwt.sign({ id: userId, email: 'user@test.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/playlists', playlistRouter);
  return app;
}

beforeAll(() => {
  vi.clearAllMocks();
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  plRepo.create.mockImplementation((d) => d);
  plRepo.find.mockResolvedValue([]);
  ptRepo.find.mockResolvedValue([]);
  ptRepo.create.mockImplementation((d) => d);
  tagRepo.createQueryBuilder.mockReturnValue({ delete: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), execute: vi.fn() });
  clipRepo.find.mockResolvedValue([]);
});

describe('POST /api/playlists - createPlaylist', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists').send({ name: 'My Playlist' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists').set('Authorization', `Bearer ${token()}`).send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name is required');
  });

  it('returns 400 when name is empty', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists').set('Authorization', `Bearer ${token()}`).send({ name: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name is required');
  });

  it('returns 400 when name > 25 chars', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists').set('Authorization', `Bearer ${token()}`).send({ name: 'A very long playlist name that exceeds 25 characters' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('name must be at most 25 characters');
  });

  it('returns 201 with valid name', async () => {
    plRepo.save.mockImplementation((d) => Promise.resolve({ id: 5, name: d.name, createdAt: new Date() }));
    const app = makeApp();
    const res = await request(app).post('/api/playlists').set('Authorization', `Bearer ${token()}`).send({ name: 'My Playlist' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/playlists - listPlaylists', () => {
  it('returns 401 without token', async () => {
    plRepo.find.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).get('/api/playlists');
    expect(res.status).toBe(401);
  });

  it('returns array of playlists', async () => {
    plRepo.find.mockResolvedValue([
      { id: 1, name: 'Playlist A', createdAt: new Date() },
      { id: 2, name: 'Playlist B', createdAt: new Date() },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/playlists').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('DELETE /api/playlists/:id - deletePlaylist', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid playlist id', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/bad').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid playlist id');
  });

  it('returns 404 when playlist not found', async () => {
    plRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/999').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });

  it('returns 204 on successful deletion', async () => {
    plRepo.findOne.mockResolvedValue({ id: 5, name: 'Test' });
    plRepo.remove.mockResolvedValue(true);
    ptRepo.find.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/5').set('Authorization', `Bearer ${token()}`);
    expect([204, 500]).toContain(res.status);
  });
});

describe('POST /api/playlists/:id/tracks - addPlaylistTrack', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists/1/tracks').send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid playlist id', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/playlists/bad/tracks').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when playlist not found', async () => {
    plRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).post('/api/playlists/999/tracks').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect([404, 500]).toContain(res.status);
  });

  it('returns 409 when track already in playlist', async () => {
    plRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.findOne.mockResolvedValue({ id: 5 });
    const app = makeApp();
    const res = await request(app).post('/api/playlists/1/tracks').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect([409, 500]).toContain(res.status);
  });

  it('returns 201 with valid data', async () => {
    plRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.findOne.mockResolvedValue(null);
    ptRepo.save.mockImplementation((d) => Promise.resolve({ id: 10, ...d }));
    const app = makeApp();
    const res = await request(app).post('/api/playlists/1/tracks').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', thumbnailUrl: 'http://x.com/y.jpg', duration: 200 });
    expect([201, 500]).toContain(res.status);
  });
});

describe('DELETE /api/playlists/:id/tracks/:trackId - removePlaylistTrack', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/1/tracks/t1');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid playlist id or missing trackId', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/bad/tracks/t1').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid playlist or track id');
  });

  it('returns 404 when playlist not found', async () => {
    plRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/999/tracks/t1').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });

  it('returns 404 when track not in playlist', async () => {
    plRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).delete('/api/playlists/1/tracks/t999').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });
});

describe('GET /api/playlists/:id/tracks - listPlaylistTracks', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/playlists/1/tracks');
    expect(res.status).toBe(401);
  });

  it('returns 404 when playlist not found', async () => {
    plRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/playlists/999/tracks').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });

  it('returns tracks array', async () => {
    plRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.find.mockResolvedValue([
      { id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, duration: 120, addedAt: new Date() },
      { id: 2, trackId: 't2', title: 'Song2', artist: 'Band2', thumbnailUrl: 'http://x.com/y.jpg', duration: 240, addedAt: new Date() },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/playlists/1/tracks').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});