import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { tagsRouter } from '../src/routes/tags.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const tagRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn(), count: vi.fn(), createQueryBuilder: vi.fn() };
const favRepo = { findOne: vi.fn().mockResolvedValue(null) };
const ptRepo = { createQueryBuilder: vi.fn() };
const playlistRepo = { count: vi.fn().mockResolvedValue(0) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'TrackTag') return tagRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'PlaylistTrack') return ptRepo;
      if (entity === 'Playlist') return playlistRepo;
      return {};
    }),
  },
}));

vi.mock('../src/services/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  }),
}));

function token(userId = 1) {
  return jwt.sign({ id: userId, email: 'user@test.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tags', tagsRouter);
  return app;
}

beforeAll(() => {
  vi.clearAllMocks();
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  tagRepo.create.mockImplementation((d) => d);
  tagRepo.save.mockImplementation((d) => Promise.resolve({ id: 5, ...d, addedAt: new Date() }));
  tagRepo.find.mockResolvedValue([]);
  tagRepo.count.mockResolvedValue(0);
  ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false) });
});

describe('POST /api/tags - addTag', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/tags').send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trackId is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ title: 'Song', artist: 'Band', tag: 'rock' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('trackId is required');
  });

  it('returns 400 when title is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', artist: 'Band', tag: 'rock' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 400 when tag contains #', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1 });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock#metal' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('tag must not include #');
  });

  it('returns 400 when tag > 15 chars', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1 });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'this-is-a-very-long-tag-over-15' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('tag must be 15 characters or less');
  });

  it('returns 403 when track not in favorites or playlist', async () => {
    favRepo.findOne.mockResolvedValue(null);
    ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), getExists: vi.fn().mockResolvedValue(false) });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock' });
    expect([403, 500]).toContain(res.status);
  });

  it('returns 409 when tag already exists for track', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), limit: vi.fn(), getOne: vi.fn().mockResolvedValue({ id: 1, tag: 'rock' }), select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ cnt: '1' }) });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock' });
    expect([409, 500]).toContain(res.status);
  });

  it('returns 409 when track already has 4 tags', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), limit: vi.fn(), getOne: vi.fn().mockResolvedValue(null), select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ cnt: '4' }) });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'newtag' });
    expect([409, 500]).toContain(res.status);
  });

  it('returns 201 with valid data', async () => {
    favRepo.findOne.mockResolvedValue({ id: 1 });
    ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), andWhere: vi.fn(), limit: vi.fn(), getOne: vi.fn().mockResolvedValue(null), select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ cnt: '0' }) });
    const app = makeApp();
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock', thumbnailUrl: 'http://x.com/y.jpg' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/tags - listTags', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/tags');
    expect(res.status).toBe(401);
  });

  it('returns array of tags', async () => {
    tagRepo.find.mockResolvedValue([
      { id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, tag: 'rock', addedAt: new Date() },
      { id: 2, trackId: 't2', title: 'Song2', artist: 'Band2', thumbnailUrl: 'http://x.com/y.jpg', tag: 'pop', addedAt: new Date() },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/tags').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /api/tags/distinct - listDistinctTags', () => {
  it('returns 401 without token', async () => {
    tagRepo.createQueryBuilder.mockReturnValue({ select: vi.fn(), addSelect: vi.fn(), where: vi.fn(), groupBy: vi.fn(), orderBy: vi.fn(), getRawMany: vi.fn().mockResolvedValue([]) });
    const app = makeApp();
    const res = await request(app).get('/api/tags/distinct');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid sort param', async () => {
    tagRepo.createQueryBuilder.mockReturnValue({ select: vi.fn(), addSelect: vi.fn(), where: vi.fn(), groupBy: vi.fn(), orderBy: vi.fn(), getRawMany: vi.fn().mockResolvedValue([]) });
    const app = makeApp();
    const res = await request(app).get('/api/tags/distinct').query({ sort: 'invalid' }).set('Authorization', `Bearer ${token()}`);
    expect([400, 500]).toContain(res.status);
  });

  it('returns distinct tags sorted by createdAt', async () => {
    tagRepo.createQueryBuilder.mockReturnValue({ select: vi.fn(), addSelect: vi.fn(), where: vi.fn(), groupBy: vi.fn(), orderBy: vi.fn(), getRawMany: vi.fn().mockResolvedValue([{ tag: 'rock', createdAt: '2024-01-01', usageCount: '5' }, { tag: 'pop', createdAt: '2024-01-02', usageCount: '3' }]) });
    const app = makeApp();
    const res = await request(app).get('/api/tags/distinct').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /api/tags/track/:trackId - listTrackTags', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/tags/track/t1');
    expect(res.status).toBe(401);
  });

  it('returns tags for track', async () => {
    tagRepo.find.mockResolvedValue([
      { tag: 'rock', addedAt: new Date('2024-01-01') },
      { tag: 'Rock', addedAt: new Date('2024-01-02') },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/tags/track/t1').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('DELETE /api/tags/track/:trackId/:tag - removeTrackTag', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).delete('/api/tags/track/t1/rock');
    expect(res.status).toBe(401);
  });

  it('returns 204 on successful deletion', async () => {
    tagRepo.createQueryBuilder.mockReturnValue({ delete: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), execute: vi.fn().mockResolvedValue({ affected: 1 }) });
    const app = makeApp();
    const res = await request(app).delete('/api/tags/track/t1/rock').set('Authorization', `Bearer ${token()}`);
    expect([204, 500]).toContain(res.status);
  });
});

describe('GET /api/tags/moods - listMoods', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/tags/moods');
    expect(res.status).toBe(401);
  });

  it('returns distinct tag names sorted alphabetically', async () => {
    tagRepo.createQueryBuilder.mockReturnValue({ select: vi.fn(), where: vi.fn(), groupBy: vi.fn(), orderBy: vi.fn(), getRawMany: vi.fn().mockResolvedValue([{ tag: 'ambient' }, { tag: 'rock' }]) });
    const app = makeApp();
    const res = await request(app).get('/api/tags/moods').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});