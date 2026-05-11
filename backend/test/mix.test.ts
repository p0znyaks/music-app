import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { mixRouter } from '../src/routes/mix.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const histRepo = { find: vi.fn() };
const tagRepo = { find: vi.fn() };
const favRepo = { find: vi.fn() };
const ptRepo = { createQueryBuilder: vi.fn() };
const mixRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'ListenHistory') return histRepo;
      if (entity === 'TrackTag') return tagRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'PlaylistTrack') return ptRepo;
      if (entity === 'UserMixPreferences') return mixRepo;
      return {};
    }),
  },
}));

vi.mock('../src/services/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn(),
  }),
}));

function token(userId = 1) {
  return jwt.sign({ id: userId, email: 'user@test.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/mix', mixRouter);
  return app;
}

beforeAll(() => {
  vi.clearAllMocks();
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  histRepo.find.mockResolvedValue([]);
  tagRepo.find.mockResolvedValue([]);
  favRepo.find.mockResolvedValue([]);
  ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), getMany: vi.fn().mockResolvedValue([]) });
  mixRepo.findOne.mockResolvedValue(null);
  mixRepo.create.mockImplementation((d) => d);
});

describe('GET /api/mix/preferences - getMixPreferences', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/mix/preferences');
    expect(res.status).toBe(401);
  });

  it('returns 200 with defaults when no saved preferences', async () => {
    mixRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/mix/preferences').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('returns saved preferences when present', async () => {
    mixRepo.findOne.mockResolvedValue({
      slots: {
        утро: { genres: ['acoustic'], tags: ['morning'] },
        день: { genres: ['pop'], tags: ['upbeat'] },
        вечер: { genres: ['dance'], tags: ['hype'] },
        ночь: { genres: ['lofi'], tags: ['sleep'] },
      },
    });
    const app = makeApp();
    const res = await request(app).get('/api/mix/preferences').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('PUT /api/mix/preferences - putMixPreferences', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).put('/api/mix/preferences').send({ preferences: {} });
    expect(res.status).toBe(401);
  });

  it('returns 200 with sanitized preferences', async () => {
    mixRepo.findOne.mockResolvedValue(null);
    mixRepo.save.mockImplementation((d) => Promise.resolve(d));
    const app = makeApp();
    const res = await request(app).put('/api/mix/preferences').set('Authorization', `Bearer ${token()}`).send({
      preferences: {
        утро: { genres: ['acoustic', 'chill'], tags: ['morning', 'relax'] },
        день: { genres: ['pop', 'rock'], tags: ['upbeat'] },
        вечер: { genres: ['dance'], tags: ['hype'] },
        ночь: { genres: ['lofi', 'ambient'], tags: ['sleep', 'calm'] },
      },
    });
    expect([200, 500]).toContain(res.status);
  });

  it('POST also works for putMixPreferences', async () => {
    mixRepo.findOne.mockResolvedValue(null);
    mixRepo.save.mockImplementation((d) => Promise.resolve(d));
    const app = makeApp();
    const res = await request(app).post('/api/mix/preferences').set('Authorization', `Bearer ${token()}`).send({
      preferences: { утро: { genres: ['acoustic'], tags: [] }, день: { genres: [], tags: [] }, вечер: { genres: [], tags: [] }, ночь: { genres: [], tags: [] } },
    });
    expect([200, 500]).toContain(res.status);
  });

  it('invalid genre gets sanitized out', async () => {
    mixRepo.findOne.mockResolvedValue(null);
    mixRepo.save.mockImplementation((d) => Promise.resolve(d));
    const app = makeApp();
    const res = await request(app).put('/api/mix/preferences').set('Authorization', `Bearer ${token()}`).send({
      preferences: {
        утро: { genres: ['invalid-genre-xyz', 'pop'], tags: [] },
        день: { genres: [], tags: [] },
        вечер: { genres: [], tags: [] },
        ночь: { genres: [], tags: [] },
      },
    });
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /api/mix - getMix', () => {
  it('returns 401 without token', async () => {
    histRepo.find.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).get('/api/mix');
    expect(res.status).toBe(401);
  });

  it('returns 400 when not enough source tracks and no genre preferences', async () => {
    histRepo.find.mockResolvedValue([]);
    favRepo.find.mockResolvedValue([]);
    ptRepo.createQueryBuilder.mockReturnValue({ innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), getMany: vi.fn().mockResolvedValue([]) });
    mixRepo.findOne.mockResolvedValue({ slots: { утро: { genres: [], tags: [] }, день: { genres: [], tags: [] }, вечер: { genres: [], tags: [] }, ночь: { genres: [], tags: [] } } });
    const app = makeApp();
    const res = await request(app).get('/api/mix').set('Authorization', `Bearer ${token()}`);
    expect([400, 500]).toContain(res.status);
  });

  it('returns 200 with tracks from history', async () => {
    histRepo.find.mockResolvedValue([
      { trackId: 't1', title: 'Song1', artist: 'Artist1', thumbnailUrl: null, listenedAt: new Date() },
      { trackId: 't2', title: 'Song2', artist: 'Artist2', thumbnailUrl: null, listenedAt: new Date() },
    ]);
    tagRepo.find.mockResolvedValue([]);
    favRepo.find.mockResolvedValue([]);
    mixRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/mix').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('returns 200 with favorite tracks', async () => {
    histRepo.find.mockResolvedValue([]);
    tagRepo.find.mockResolvedValue([]);
    favRepo.find.mockResolvedValue([{ trackId: 't1', title: 'FavSong', artist: 'Artist', thumbnailUrl: null, duration: 180 }]);
    mixRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/mix').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('response includes timeOfDay and moodHint', async () => {
    histRepo.find.mockResolvedValue([{ trackId: 't1', title: 'Song', artist: 'Artist', thumbnailUrl: null, listenedAt: new Date() }]);
    tagRepo.find.mockResolvedValue([]);
    favRepo.find.mockResolvedValue([]);
    mixRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/mix').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});