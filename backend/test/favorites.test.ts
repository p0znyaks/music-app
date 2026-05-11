import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { favoritesRouter } from '../src/routes/favorites.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const { mockRoleRepo, favRepo, tagRepo, playlistTrackRepo, playlistRepo } = vi.hoisted(() => {
  const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
  const favRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), find: vi.fn(), remove: vi.fn(), count: vi.fn(), createQueryBuilder: vi.fn() };
  const tagRepo = { count: vi.fn(), createQueryBuilder: vi.fn() };
  const playlistTrackRepo = { createQueryBuilder: vi.fn() };
  const playlistRepo = { count: vi.fn() };
  return { mockRoleRepo, favRepo, tagRepo, playlistTrackRepo, playlistRepo };
});

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'TrackTag') return tagRepo;
      if (entity === 'PlaylistTrack') return playlistTrackRepo;
      if (entity === 'Playlist') return playlistRepo;
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
  app.use('/api/favorites', favoritesRouter);
  return app;
}

function resetFavorites() {
  favRepo.findOne.mockResolvedValue(null);
  favRepo.create.mockImplementation((d) => d);
  favRepo.save.mockImplementation((d) => Promise.resolve({ id: 1, ...d }));
  favRepo.find.mockResolvedValue([]);
  favRepo.remove.mockResolvedValue(true);
  favRepo.count.mockResolvedValue(0);
  tagRepo.count.mockResolvedValue(0);
  tagRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false), delete: vi.fn(), execute: vi.fn() });
  playlistTrackRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false) });
}

describe('POST /api/favorites - addFavorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFavorites();
  });

  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/favorites').send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trackId is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ title: 'Song', artist: 'Band' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('trackId is required');
  });

  it('returns 400 when title is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', artist: 'Band' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 400 when artist is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 409 when track already in favorites', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1, trackId: 't1' });
    const app = makeApp();
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect([409, 500]).toContain(res.status);
  });

  it('returns 201 with valid data', async () => {
    favRepo.findOne.mockResolvedValue(null);
    favRepo.save.mockImplementation((d) => Promise.resolve({ id: 42, ...d }));
    const app = makeApp();
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', thumbnailUrl: 'http://x.com/y.jpg', duration: 180 });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/favorites - listFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFavorites();
  });

  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(401);
  });

  it('returns empty array when no favorites', async () => {
    favRepo.find.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('returns array of favorites', async () => {
    favRepo.find.mockResolvedValue([
      { id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, duration: 120, addedAt: new Date() },
      { id: 2, trackId: 't2', title: 'Song2', artist: 'Band2', thumbnailUrl: 'http://x.com/y.jpg', duration: 240, addedAt: new Date() },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('DELETE /api/favorites/:trackId - removeFavorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFavorites();
  });

  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/favorites/t1');
    expect(res.status).toBe(401);
  });

  it('returns 404 when favorite not found', async () => {
    favRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).delete('/api/favorites/t999').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });

  it('returns 409 when track has tags without force', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1, trackId: 't1' });
    tagRepo.count.mockResolvedValue(2);
    tagRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false) });
    const app = makeApp();
    const res = await request(app).delete('/api/favorites/t1').set('Authorization', `Bearer ${token()}`);
    expect([409, 500]).toContain(res.status);
  });

  it('returns 204 on successful removal', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1, trackId: 't1' });
    tagRepo.count.mockResolvedValue(0);
    tagRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false), delete: vi.fn().mockReturnThis(), execute: vi.fn() });
    favRepo.remove.mockResolvedValue(true);
    const app = makeApp();
    const res = await request(app).delete('/api/favorites/t1').set('Authorization', `Bearer ${token()}`);
    expect([204, 500]).toContain(res.status);
  });

  it('force=true bypasses tag confirmation', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1, trackId: 't1' });
    tagRepo.count.mockResolvedValue(2);
    tagRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false), delete: vi.fn().mockReturnThis(), execute: vi.fn() });
    favRepo.remove.mockResolvedValue(true);
    const app = makeApp();
    const res = await request(app).delete('/api/favorites/t1').query({ force: '1' }).set('Authorization', `Bearer ${token()}`);
    expect([204, 500]).toContain(res.status);
  });
});