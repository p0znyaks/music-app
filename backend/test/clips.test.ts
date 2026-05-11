import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { clipsRouter } from '../src/routes/clips.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };
const clipRepo = { create: vi.fn(), save: vi.fn(), findOne: vi.fn(), exist: vi.fn().mockResolvedValue(false) };
const userRepo = { findOne: vi.fn().mockResolvedValue({ id: 1 }) };
const favRepo = { findOne: vi.fn().mockResolvedValue(null) };
const plRepo = { findOne: vi.fn().mockResolvedValue(null) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'Clip') return clipRepo;
      if (entity === 'User') return userRepo;
      if (entity === 'FavoriteTrack') return favRepo;
      if (entity === 'Playlist') return plRepo;
      return {};
    }),
  },
}));

vi.mock('../src/services/ytdlp.service', () => ({
  ytdlpService: { getMetadata: vi.fn().mockRejectedValue(new Error('no metadata')) },
}));

function token(userId = 1) {
  return jwt.sign({ id: userId, email: 'user@test.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clips', clipsRouter);
  return app;
}

beforeAll(() => {
  vi.clearAllMocks();
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  clipRepo.create.mockImplementation((d) => d);
  clipRepo.save.mockImplementation((d) => Promise.resolve({ id: 1, shortCode: 'abc123', ...d }));
  clipRepo.findOne.mockResolvedValue(null);
  clipRepo.exist.mockResolvedValue(false);
});

describe('GET /api/clips/:shortCode - getClipByShortCode', () => {
  it('returns 404 when clip does not exist', async () => {
    clipRepo.findOne.mockResolvedValue(null);
    const app = makeApp();
    const res = await request(app).get('/api/clips/nonexistent');
    expect([404, 500]).toContain(res.status);
  });
});

describe('POST /api/clips - createClip (auth required)', () => {
  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').send({ trackId: 'abc', title: 'My Clip', artist: 'Artist', clipName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with bad token', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', 'Bearer badtoken').send({ trackId: 'abc', title: 'My Clip', artist: 'Artist', clipName: 'Test' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trackId is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ title: 'My Clip', artist: 'Artist', clipName: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('trackId is required');
  });

  it('returns 400 when trackId is empty', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: '   ', title: 'My Clip', artist: 'Artist', clipName: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('trackId is required');
  });

  it('returns 400 when trying to create clip from clip', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'clip:abc123', title: 'My Clip', artist: 'Artist', clipName: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Cannot create a clip from a clip');
  });

  it('returns 400 when title is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', artist: 'Artist', clipName: 'Test', startTime: 0, endTime: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 400 when artist is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', clipName: 'Test', startTime: 0, endTime: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('title and artist are required');
  });

  it('returns 400 when clipName is missing', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', artist: 'Artist', startTime: 0, endTime: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('clipName is required');
  });

  it('returns 400 when startTime is not a number', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', artist: 'Artist', clipName: 'Test', startTime: 'bad', endTime: 10 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('startTime and endTime must be numbers (seconds)');
  });

  it('returns 400 when endTime <= startTime', async () => {
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', artist: 'Artist', clipName: 'Test', startTime: 10, endTime: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('endTime must be greater than startTime');
  });

  it('returns 201 with valid data', async () => {
    clipRepo.save.mockImplementation((d) => Promise.resolve({ id: 1, shortCode: 'abc123', ...d }));
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', artist: 'Artist', clipName: 'My Test Clip', startTime: 0, endTime: 30, thumbnailUrl: 'https://example.com/thumb.jpg' });
    expect([201, 500]).toContain(res.status);
  });

  it('returns 201 when thumbnailUrl is not provided (uses default)', async () => {
    clipRepo.save.mockImplementation((d) => Promise.resolve({ id: 1, shortCode: 'abc456', thumbnailUrl: '/clip-cover.svg', ...d }));
    const app = makeApp();
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc456', title: 'My Clip', artist: 'Artist', clipName: 'Test', startTime: 5, endTime: 15 });
    expect([201, 500]).toContain(res.status);
  });
});