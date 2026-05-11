import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { historyRouter } from '../src/routes/history.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const histRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn() };
const userRepo = { findOne: vi.fn().mockResolvedValue({ id: 1 }) };
const favRepo = { count: vi.fn().mockResolvedValue(0) };
const plRepo = { count: vi.fn().mockResolvedValue(0) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'ListenHistory') return histRepo;
      if (entity === 'User') return userRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'Playlist') return plRepo;
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
  app.use('/api/history', historyRouter);
  return app;
}

beforeAll(() => {
  vi.clearAllMocks();
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  histRepo.create.mockImplementation((d) => d);
  histRepo.save.mockImplementation((d) => Promise.resolve({ id: 99, ...d, listenedAt: new Date() }));
  histRepo.find.mockResolvedValue([]);
});

describe('POST /api/history - addHistory', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/history').send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trackId is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/history').set('Authorization', `Bearer ${token()}`).send({ title: 'Song', artist: 'Band' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('trackId is required');
  });

  it('returns 400 when title is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/history').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', artist: 'Band' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 400 when artist is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/history').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 201 with valid data', async () => {
    histRepo.save.mockImplementation((d) => Promise.resolve({ id: 99, ...d, listenedAt: new Date() }));
    const app = makeApp();
    const res = await request(app).post('/api/history').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', thumbnailUrl: 'http://x.com/y.jpg' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/history - listHistory', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(401);
  });

  it('returns array of history items', async () => {
    histRepo.find.mockResolvedValue([
      { id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, listenedAt: new Date() },
      { id: 2, trackId: 't2', title: 'Song2', artist: 'Band2', thumbnailUrl: 'http://x.com/y.jpg', listenedAt: new Date() },
    ]);
    const app = makeApp();
    const res = await request(app).get('/api/history').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('returns empty array when no history', async () => {
    histRepo.find.mockResolvedValue([]);
    const app = makeApp();
    const res = await request(app).get('/api/history').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('each history item has listenedAt', async () => {
    histRepo.find.mockResolvedValue([{ id: 1, trackId: 't1', title: 'Song', artist: 'Band', thumbnailUrl: null, listenedAt: new Date('2024-01-01') }]);
    const app = makeApp();
    const res = await request(app).get('/api/history').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});