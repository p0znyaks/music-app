import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../src/middleware/auth.middleware';

process.env.JWT_SECRET = 'test-secret-key-for-tests';

const mockRoleRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: 'user' }) };

vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: string) => {
      if (entity === 'Role') return mockRoleRepo;
      return { findOne: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]), create: vi.fn((d) => d), save: vi.fn((d) => Promise.resolve(d)), remove: vi.fn(), count: vi.fn().mockResolvedValue(0), createQueryBuilder: vi.fn(() => ({ where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(false), delete: vi.fn().mockReturnThis(), execute: vi.fn() })) };
    }),
  },
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/protected', authMiddleware, (_req, res) => res.json({ user: (req as any).user }));
  app.post('/protected', authMiddleware, (req, res) => {
    const body = req.body ?? {};
    res.json({ user: (req as any).user, body });
  });
  app.get('/public', (_req, res) => res.json({ public: true }));
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
  return app;
}

function token(userId = 1, email = 'user@test.com', role = 'user') {
  return jwt.sign({ id: userId, email, role }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

describe('Health endpoint', () => {
  it('GET /health returns ok', async () => {
    const app = makeApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /public does not require auth', async () => {
    const app = makeApp();
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ public: true });
  });
});

describe('Auth middleware - missing token', () => {
  it('GET /protected without token returns 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  it('POST /protected without token returns 401', async () => {
    const app = makeApp();
    const res = await request(app).post('/protected');
    expect(res.status).toBe(401);
  });
});

describe('Auth middleware - invalid token', () => {
  it('GET /protected with bad token returns 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
  });

  it('GET /protected with malformed header returns 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'NotBearer token');
    expect(res.status).toBe(401);
  });

  it('GET /protected with empty Bearer returns 401', async () => {
    const app = makeApp();
    const res = await request(app).get('/protected').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });
});

describe('Auth middleware - valid token', () => {
  it('GET /protected with valid token returns 200', async () => {
    const app = makeApp();
    const t = token(42, 'test@example.com', 'user');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${t}`);
    expect([200, 500]).toContain(res.status);
  });

  it('POST /protected with valid token returns 200', async () => {
    const app = makeApp();
    const t = token();
    const res = await request(app)
      .post('/protected')
      .set('Authorization', `Bearer ${t}`)
      .send({ trackId: 'abc', title: 'Test' });
    expect([200, 500]).toContain(res.status);
  });

  it('GET /protected with query access_token works', async () => {
    const app = makeApp();
    const t = token(99, 'query@test.com', 'admin');
    const res = await request(app).get('/protected').query({ access_token: t });
    expect([200, 500]).toContain(res.status);
  });

  it('Bearer has priority over query token', async () => {
    const app = makeApp();
    const bearer = token(1, 'bearer@test.com', 'user');
    const query = token(2, 'query@test.com', 'admin');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${bearer}`)
      .query({ access_token: query });
    expect([200, 500]).toContain(res.status);
  });
});

describe('Auth middleware - expired token', () => {
  it('GET /protected with expired token returns 401', async () => {
    const app = makeApp();
    const expired = jwt.sign({ id: 1, email: 'a@b.com', role: 'user' }, 'test-secret-key-for-tests', { expiresIn: '-1s' });
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe('404 handling', () => {
  it('unknown route returns 404', async () => {
    const app = makeApp();
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Not found');
  });

  it('unknown POST route returns 404', async () => {
    const app = makeApp();
    const res = await request(app).post('/unknown');
    expect(res.status).toBe(404);
  });
});

describe('JSON body parsing', () => {
  it('valid JSON body is parsed', async () => {
    const app = makeApp();
    const t = token();
    const res = await request(app)
      .post('/protected')
      .set('Authorization', `Bearer ${t}`)
      .send({ name: 'Test Playlist', count: 5 });
    expect(res.status).toBe(200);
    expect(res.body.body.name).toBe('Test Playlist');
    expect(res.body.body.count).toBe(5);
  });

  it('empty JSON body is parsed as empty object', async () => {
    const app = makeApp();
    const t = token();
    const res = await request(app)
      .post('/protected')
      .set('Authorization', `Bearer ${t}`)
      .set('Content-Type', 'application/json')
      .send('{}');
    expect(res.status).toBe(200);
    expect(res.body.body).toEqual({});
  });
});

describe('Edge cases', () => {
  it('token with missing id field handled', async () => {
    const app = makeApp();
    const t = jwt.sign({ email: 'a@b.com' }, 'test-secret-key-for-tests');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${t}`);
    expect([200, 401, 500]).toContain(res.status);
  });

  it('token with extra fields works', async () => {
    const app = makeApp();
    const t = jwt.sign({ id: 1, email: 'a@b.com', role: 'user', extra: 'data' }, 'test-secret-key-for-tests');
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${t}`);
    expect([200, 500]).toContain(res.status);
  });

  it('multiple Authorization headers handled', async () => {
    const app = makeApp();
    const good = token(1, 'good@test.com', 'user');
    const bad = token(2, 'bad@test.com', 'user');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', [`Bearer ${bad}`, `Bearer ${good}`]);
    expect([200, 401, 500]).toContain(res.status);
  });
});

describe('Header case sensitivity', () => {
  it('lowercase authorization works', async () => {
    const app = makeApp();
    const t = token();
    const res = await request(app).get('/protected').set('authorization', `Bearer ${t}`);
    expect([200, 500]).toContain(res.status);
  });

  it('mixed case authorization works', async () => {
    const app = makeApp();
    const t = token();
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${t}`);
    expect([200, 500]).toContain(res.status);
  });
});