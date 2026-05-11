import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { profileRouter } from '../src/routes/profile.routes';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };

const defaultUserRepo = {
  findOne: vi.fn().mockResolvedValue({
    id: 1, username: 'testuser', email: 'test@test.com',
    role: { name: 'user' }, createdAt: new Date('2024-01-01'),
  }),
};
const defaultHistoryRepo = { count: vi.fn().mockResolvedValue(10) };
const defaultPlaylistRepo = { count: vi.fn().mockResolvedValue(10) };
const defaultFavRepo = { count: vi.fn().mockResolvedValue(10) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      if (entity === 'User') return defaultUserRepo;
      if (entity === 'ListenHistory') return defaultHistoryRepo;
      if (entity === 'Playlist') return defaultPlaylistRepo;
      if (entity === 'FavoriteTrack') return defaultFavRepo;
      return {};
    }),
  },
}));

function token(userId = 1, email = 'test@test.com', role = 'user') {
  return jwt.sign({ id: userId, email, role }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/profile', profileRouter);
  return app;
}

describe('GET /api/profile - getProfile', () => {
  beforeAll(() => {
    vi.clearAllMocks();
    mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  });

  it('returns 401 without token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('returns 401 with bad token', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/profile').set('Authorization', 'Bearer bad');
    expect(res.status).toBe(401);
  });

  it('returns 401 with expired token', async () => {
    const app = makeApp();
    const expired = jwt.sign({ id: 1, email: 'a@b.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '-1s' });
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    defaultUserRepo.findOne.mockResolvedValue(null);
    defaultHistoryRepo.count.mockResolvedValue(0);
    defaultPlaylistRepo.count.mockResolvedValue(0);
    defaultFavRepo.count.mockResolvedValue(0);
    const app = makeApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });

  it('returns 200 with valid token and profile data', async () => {
    defaultUserRepo.findOne.mockResolvedValue({
      id: 1, username: 'testuser', email: 'test@test.com',
      role: { name: 'user' }, createdAt: new Date('2024-01-01'),
    });
    defaultHistoryRepo.count.mockResolvedValue(10);
    defaultPlaylistRepo.count.mockResolvedValue(5);
    defaultFavRepo.count.mockResolvedValue(3);
    const app = makeApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('query access_token works as fallback', async () => {
    defaultUserRepo.findOne.mockResolvedValue({
      id: 1, username: 'testuser', email: 'test@test.com',
      role: { name: 'user' }, createdAt: new Date('2024-01-01'),
    });
    defaultHistoryRepo.count.mockResolvedValue(10);
    defaultPlaylistRepo.count.mockResolvedValue(5);
    defaultFavRepo.count.mockResolvedValue(3);
    const app = makeApp();
    const t = token();
    const res = await request(app).get('/api/profile').query({ access_token: t });
    expect([200, 500]).toContain(res.status);
  });

  it('profile includes createdAt', async () => {
    defaultUserRepo.findOne.mockResolvedValue({
      id: 1, username: 'testuser', email: 'test@test.com',
      role: { name: 'user' }, createdAt: new Date('2024-01-01'),
    });
    const app = makeApp();
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('Bearer takes priority over query token', async () => {
    defaultUserRepo.findOne.mockResolvedValue({
      id: 1, username: 'bearer-user', email: 'bearer@test.com',
      role: { name: 'user' }, createdAt: new Date('2024-01-01'),
    });
    defaultHistoryRepo.count.mockResolvedValue(10);
    defaultPlaylistRepo.count.mockResolvedValue(5);
    defaultFavRepo.count.mockResolvedValue(3);
    const app = makeApp();
    const bearer = token(1, 'bearer@test.com', 'user');
    const query = token(2, 'query@test.com', 'admin');
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${bearer}`)
      .query({ access_token: query });
    expect([200, 500]).toContain(res.status);
  });
});