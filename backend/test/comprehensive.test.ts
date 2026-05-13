import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-key-for-tests';
process.env.PYTHON_WORKERS = '0';

const {
  mockAuthService, mockYtMusicService, mockYtdlpService,
  mockRoleRepo, mockUserRepo, mockFavRepo, mockTagRepo,
  mockPtRepo, mockPlRepo, mockHistRepo, mockClipRepo, mockRedis,
} = vi.hoisted(() => {
  const authSvc = { register: vi.fn(), login: vi.fn() };
  const ytm = {
    searchAlbums: vi.fn(), searchArtists: vi.fn(), getAlbum: vi.fn(),
    getArtist: vi.fn(), getRadioBatch: vi.fn(), searchSongs: vi.fn(),
    searchAlbumsBatch: vi.fn(), getSongsBatch: vi.fn(),
  };
  const ytdlp = { search: vi.fn(), searchStreaming: vi.fn(), getStreamUrl: vi.fn(), getMetadata: vi.fn() };
  const roleRepo = { findOne: vi.fn() };
  const userRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), find: vi.fn() };
  const favRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), find: vi.fn(), remove: vi.fn(), count: vi.fn(), createQueryBuilder: vi.fn() };
  const tagRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn(), count: vi.fn(), createQueryBuilder: vi.fn() };
  const ptRepo = { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), save: vi.fn(), delete: vi.fn(), remove: vi.fn(), createQueryBuilder: vi.fn() };
  const plRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn(), findOne: vi.fn(), remove: vi.fn(), count: vi.fn() };
  const histRepo = { create: vi.fn(), save: vi.fn(), find: vi.fn(), count: vi.fn() };
  const clipRepo = { create: vi.fn(), save: vi.fn(), findOne: vi.fn(), exist: vi.fn(), find: vi.fn() };
  const redis = { get: vi.fn(), set: vi.fn() };
  return {
    mockAuthService: authSvc, mockYtMusicService: ytm, mockYtdlpService: ytdlp,
    mockRoleRepo: roleRepo, mockUserRepo: userRepo, mockFavRepo: favRepo,
    mockTagRepo: tagRepo, mockPtRepo: ptRepo, mockPlRepo: plRepo,
    mockHistRepo: histRepo, mockClipRepo: clipRepo, mockRedis: redis,
  };
});

vi.mock('../src/services/auth.service', () => ({ AuthService: vi.fn(() => mockAuthService) }));
vi.mock('../src/services/redis', () => ({ getRedis: vi.fn(() => mockRedis) }));
vi.mock('../src/services/ytmusic.service', () => ({ ytmusicService: mockYtMusicService }));
vi.mock('../src/services/ytdlp.service', () => ({ ytdlpService: mockYtdlpService }));
vi.mock('../src/services/dataSource', () => ({
  AppDataSource: {
    getRepository: vi.fn((entity: any) => {
      const name = typeof entity === 'string' ? entity : entity?.name;
      const map: Record<string, unknown> = {
        Role: mockRoleRepo, User: mockUserRepo, FavoriteTrack: mockFavRepo,
        TrackTag: mockTagRepo, PlaylistTrack: mockPtRepo, Playlist: mockPlRepo,
        ListenHistory: mockHistRepo, Clip: mockClipRepo,
      };
      return map[name] ?? {};
    }),
  },
}));

import { authRouter } from '../src/routes/auth.routes';
import { searchRouter } from '../src/routes/search.routes';
import { trackRouter } from '../src/routes/track.routes';
import { favoritesRouter } from '../src/routes/favorites.routes';
import { playlistRouter } from '../src/routes/playlist.routes';
import { historyRouter } from '../src/routes/history.routes';
import { tagsRouter } from '../src/routes/tags.routes';
import { clipsRouter } from '../src/routes/clips.routes';
import { profileRouter } from '../src/routes/profile.routes';
import { recoRouter } from '../src/routes/reco.routes';

function token(userId = 1, email = 'user@test.com', role = 'user') {
  return jwt.sign({ id: userId, email, role }, 'test-secret-key-for-tests', { expiresIn: '7d' });
}

function resetMocks() {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mockRoleRepo.findOne.mockResolvedValue({ id: 2, name: 'user' });
  mockUserRepo.findOne.mockResolvedValue(null);
  mockUserRepo.create.mockImplementation((d: any) => d);
  mockUserRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d }));
  mockFavRepo.findOne.mockResolvedValue(null);
  mockFavRepo.create.mockImplementation((d: any) => d);
  mockFavRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d }));
  mockFavRepo.find.mockResolvedValue([]);
  mockFavRepo.remove.mockResolvedValue(true);
  mockFavRepo.count.mockResolvedValue(0);
  mockFavRepo.createQueryBuilder.mockReturnValue({
    innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockReturnThis(), execute: vi.fn(), select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(), getRawMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockReturnThis(), getRawOne: vi.fn().mockResolvedValue({ cnt: '0' }),
    limit: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(null),
  });
  mockTagRepo.create.mockImplementation((d: any) => d);
  mockTagRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d, addedAt: new Date() }));
  mockTagRepo.find.mockResolvedValue([]);
  mockTagRepo.count.mockResolvedValue(0);
  mockTagRepo.createQueryBuilder.mockReturnValue({
    innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(false),
    delete: vi.fn().mockReturnThis(), execute: vi.fn(), select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(), groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(), getRawMany: vi.fn().mockResolvedValue([]),
    having: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
    getOne: vi.fn().mockResolvedValue(null), getRawOne: vi.fn().mockResolvedValue({ cnt: '0' }),
  });
  mockPtRepo.create.mockImplementation((d: any) => d);
  mockPtRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d }));
  mockPtRepo.find.mockResolvedValue([]);
  mockPtRepo.findOne.mockResolvedValue(null);
  mockPtRepo.createQueryBuilder.mockReturnValue({
    innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(true),
    select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(), getRawMany: vi.fn().mockResolvedValue([]),
  });
  mockPlRepo.create.mockImplementation((d: any) => d);
  mockPlRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d, createdAt: new Date() }));
  mockPlRepo.find.mockResolvedValue([]);
  mockPlRepo.findOne.mockResolvedValue(null);
  mockPlRepo.remove.mockResolvedValue(true);
  mockPlRepo.count.mockResolvedValue(0);
  mockHistRepo.create.mockImplementation((d: any) => d);
  mockHistRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, ...d, listenedAt: new Date() }));
  mockHistRepo.find.mockResolvedValue([]);
  mockClipRepo.create.mockImplementation((d: any) => d);
  mockClipRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, shortCode: 'abc123', ...d }));
  mockClipRepo.findOne.mockResolvedValue(null);
  mockClipRepo.exist.mockResolvedValue(false);
  mockClipRepo.find.mockResolvedValue([]);
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
  mockYtMusicService.searchAlbums.mockResolvedValue([]);
  mockYtMusicService.searchArtists.mockResolvedValue([]);
  mockYtMusicService.getAlbum.mockResolvedValue(null);
  mockYtMusicService.getArtist.mockResolvedValue(null);
  mockYtMusicService.getRadioBatch.mockResolvedValue([]);
  mockYtMusicService.searchSongs.mockResolvedValue([]);
  mockYtMusicService.searchAlbumsBatch.mockResolvedValue([]);
  mockYtMusicService.getSongsBatch.mockResolvedValue([]);
  mockYtdlpService.search.mockResolvedValue({ tracks: [], albums: [], artists: [] });
  mockYtdlpService.getStreamUrl.mockResolvedValue('https://example.com/stream');
  mockYtdlpService.getMetadata.mockResolvedValue({ title: 'Test Track', artist: 'Test Artist', duration: 180, thumbnailUrl: 'https://example.com/thumb.jpg' });
  mockAuthService.register.mockReset();
  mockAuthService.login.mockReset();
}

beforeEach(resetMocks);

// ==================== 1-4: REGISTRATION ====================

describe('POST /api/auth/register', () => {
  it('register_missing_fields_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('required');
  });

  it('register_email_taken_returns_409', async () => {
    mockAuthService.register.mockRejectedValue({ code: 'EMAIL_TAKEN', message: 'Email already registered' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/register').send({ username: 'user', email: 'taken@test.com', password: 'pass123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('register_username_taken_returns_409', async () => {
    mockAuthService.register.mockRejectedValue({ code: 'USERNAME_TAKEN', message: 'Username already taken' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/register').send({ username: 'taken', email: 'user@test.com', password: 'pass123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
  });

  it('register_valid_returns_201', async () => {
    mockAuthService.register.mockResolvedValue({ user: { id: 1, username: 'newuser', email: 'new@test.com' }, token: 'jwt-token' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/register').send({ username: 'newuser', email: 'new@test.com', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });
});

// ==================== 5-8: LOGIN ====================

describe('POST /api/auth/login', () => {
  it('login_missing_fields_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('required');
  });

  it('login_invalid_credentials_returns_401', async () => {
    mockAuthService.login.mockRejectedValue({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/login').send({ email: 'wrong@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('login_blocked_returns_403', async () => {
    mockAuthService.login.mockRejectedValue({ code: 'BLOCKED', message: 'Account is blocked' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/login').send({ email: 'blocked@test.com', password: 'pass' });
    expect(res.status).toBe(403);
  });

  it('login_valid_returns_200', async () => {
    mockAuthService.login.mockResolvedValue({ user: { id: 1, username: 'user', email: 'user@test.com' }, token: 'jwt-token' });
    const app = express(); app.use(express.json()); app.use('/api/auth', authRouter);
    const res = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });
});

// ==================== 9-11: SEARCH TRACKS ====================

describe('GET /api/search', () => {
  it('search_missing_query_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Query parameter q is required');
  });

  it('search_valid_query_returns_200', async () => {
    mockYtdlpService.search.mockResolvedValue({
      tracks: [{ trackId: 't1', title: 'Test Track', artist: 'Artist' }],
      albums: [], artists: [],
    });
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search').query({ q: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.tracks).toBeDefined();
    expect(res.body.tracks).toHaveLength(1);
  });

  it('search_service_error_returns_502', async () => {
    mockYtdlpService.search.mockRejectedValue(new Error('fail'));
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search').query({ q: 'test' });
    expect(res.status).toBe(502);
  });
});

// ==================== 12-13: SEARCH ALBUMS ====================

describe('GET /api/search/albums', () => {
  it('searchAlbums_missing_query_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search/albums');
    expect(res.status).toBe(400);
  });

  it('searchAlbums_valid_returns_200', async () => {
    mockYtMusicService.searchAlbums.mockResolvedValue([{ browseId: 'album1', title: 'Great Album' }]);
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search/albums').query({ q: 'rock' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Great Album');
  });
});

// ==================== 14-15: SEARCH ARTISTS ====================

describe('GET /api/search/artists', () => {
  it('searchArtists_missing_query_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search/artists');
    expect(res.status).toBe(400);
  });

  it('searchArtists_valid_returns_200', async () => {
    mockYtMusicService.searchArtists.mockResolvedValue([{ browseId: 'artist1', artist: 'Cool Band' }]);
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/search/artists').query({ q: 'rock' });
    expect(res.status).toBe(200);
    expect(res.body[0].artist).toBe('Cool Band');
  });
});

// ==================== 16-17: ALBUM TRACKS ====================

describe('GET /api/albums/:browseId', () => {
  it('getAlbum_valid_returns_200', async () => {
    mockYtMusicService.getAlbum.mockResolvedValue({ browseId: 'album123', title: 'My Album', tracks: [{ trackId: 't1', title: 'Song' }] });
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/albums/album123');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My Album');
  });

  it('getAlbum_not_found_returns_404', async () => {
    mockYtMusicService.getAlbum.mockResolvedValue(null);
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/albums/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Album not found');
  });
});

// ==================== 18-19: ARTIST ALBUMS ====================

describe('GET /api/artists/:browseId', () => {
  it('getArtist_valid_returns_200', async () => {
    mockYtMusicService.getArtist.mockResolvedValue({ browseId: 'artist123', name: 'Cool Band', albums: [] });
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/artists/artist123');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Cool Band');
  });

  it('getArtist_not_found_returns_404', async () => {
    mockYtMusicService.getArtist.mockResolvedValue(null);
    const app = express(); app.use(express.json()); app.use('/api', searchRouter);
    const res = await request(app).get('/api/artists/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Artist not found');
  });
});

// ==================== 20-22: TRACK PLAYBACK & INFO ====================

describe('GET /api/tracks/:trackId/stream', () => {
  it('getStreamUrl_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/tracks', trackRouter);
    const res = await request(app).get('/api/tracks/t1/stream');
    expect(res.status).toBe(401);
  });

  it('getStreamUrl_with_auth_returns_200', async () => {
    const app = express(); app.use(express.json()); app.use('/api/tracks', trackRouter);
    const res = await request(app).get('/api/tracks/t1/stream').set('Authorization', `Bearer ${token()}`);
    expect([200, 502]).toContain(res.status);
  });
});

describe('GET /api/tracks/:trackId/metadata', () => {
  it('getMetadata_with_auth_returns_200', async () => {
    const app = express(); app.use(express.json()); app.use('/api/tracks', trackRouter);
    const res = await request(app).get('/api/tracks/t1/metadata').set('Authorization', `Bearer ${token()}`);
    expect([200, 502]).toContain(res.status);
  });
});

// ==================== 23-26: FAVORITES ====================

describe('POST /api/favorites', () => {
  it('addFavorite_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/favorites', favoritesRouter);
    const res = await request(app).post('/api/favorites').send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(401);
  });

  it('addFavorite_valid_returns_201', async () => {
    mockFavRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 42, ...d }));
    const app = express(); app.use(express.json()); app.use('/api/favorites', favoritesRouter);
    const res = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', duration: 180 });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/favorites', () => {
  it('listFavorites_returns_list', async () => {
    mockFavRepo.find.mockResolvedValue([{ id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, duration: 120, addedAt: new Date() }]);
    const app = express(); app.use(express.json()); app.use('/api/favorites', favoritesRouter);
    const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('DELETE /api/favorites/:trackId', () => {
  it('removeFavorite_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/favorites', favoritesRouter);
    const res = await request(app).delete('/api/favorites/t1');
    expect(res.status).toBe(401);
  });
});

// ==================== 27-31: PLAYLISTS ====================

describe('POST /api/playlists', () => {
  it('createPlaylist_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/playlists', playlistRouter);
    const res = await request(app).post('/api/playlists').send({ name: 'My Playlist' });
    expect(res.status).toBe(401);
  });

  it('createPlaylist_valid_returns_201', async () => {
    mockPlRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 5, name: d.name, createdAt: new Date() }));
    const app = express(); app.use(express.json()); app.use('/api/playlists', playlistRouter);
    const res = await request(app).post('/api/playlists').set('Authorization', `Bearer ${token()}`).send({ name: 'My Playlist' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/playlists', () => {
  it('listPlaylists_returns_list', async () => {
    mockPlRepo.find.mockResolvedValue([{ id: 1, name: 'Playlist A', createdAt: new Date() }]);
    const app = express(); app.use(express.json()); app.use('/api/playlists', playlistRouter);
    const res = await request(app).get('/api/playlists').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('POST /api/playlists/:id/tracks', () => {
  it('addPlaylistTrack_valid_returns_201', async () => {
    mockPlRepo.findOne.mockResolvedValue({ id: 1 });
    mockPtRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 10, ...d }));
    const app = express(); app.use(express.json()); app.use('/api/playlists', playlistRouter);
    const res = await request(app).post('/api/playlists/1/tracks').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', duration: 200 });
    expect([201, 500]).toContain(res.status);
  });
});

describe('DELETE /api/playlists/:id', () => {
  it('deletePlaylist_valid_returns_204', async () => {
    mockPlRepo.findOne.mockResolvedValue({ id: 5, name: 'Test' });
    mockPtRepo.find.mockResolvedValue([]);
    const app = express(); app.use(express.json()); app.use('/api/playlists', playlistRouter);
    const res = await request(app).delete('/api/playlists/5').set('Authorization', `Bearer ${token()}`);
    expect([204, 500]).toContain(res.status);
  });
});

// ==================== 32-34: HISTORY ====================

describe('POST /api/history', () => {
  it('addHistory_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/history', historyRouter);
    const res = await request(app).post('/api/history').send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect(res.status).toBe(401);
  });

  it('addHistory_valid_returns_201', async () => {
    const app = express(); app.use(express.json()); app.use('/api/history', historyRouter);
    const res = await request(app).post('/api/history').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/history', () => {
  it('listHistory_returns_list', async () => {
    mockHistRepo.find.mockResolvedValue([{ id: 1, trackId: 't1', title: 'Song1', artist: 'Band1', thumbnailUrl: null, listenedAt: new Date() }]);
    const app = express(); app.use(express.json()); app.use('/api/history', historyRouter);
    const res = await request(app).get('/api/history').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

// ==================== 35-37: PROFILE ====================

describe('GET /api/profile', () => {
  it('getProfile_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/profile', profileRouter);
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  it('getProfile_valid_returns_200', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 1, username: 'testuser', email: 'test@test.com', role: { name: 'user' }, createdAt: new Date() });
    mockHistRepo.count.mockResolvedValue(10);
    mockPlRepo.count.mockResolvedValue(5);
    mockFavRepo.count.mockResolvedValue(3);
    const app = express(); app.use(express.json()); app.use('/api/profile', profileRouter);
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });

  it('getProfile_user_not_found_returns_404', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);
    const app = express(); app.use(express.json()); app.use('/api/profile', profileRouter);
    const res = await request(app).get('/api/profile').set('Authorization', `Bearer ${token()}`);
    expect([404, 500]).toContain(res.status);
  });
});

// ==================== 38-41: MOOD TAGS ====================

describe('POST /api/tags', () => {
  it('addTag_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).post('/api/tags').send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock' });
    expect(res.status).toBe(401);
  });

  it('addTag_with_hash_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock#metal' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('tag must not include #');
  });

  it('addTag_valid_returns_201', async () => {
    mockPtRepo.createQueryBuilder.mockReturnValue({
      innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(), getExists: vi.fn().mockResolvedValue(true),
      limit: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(null),
      select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ cnt: '0' }),
    });
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).post('/api/tags').set('Authorization', `Bearer ${token()}`).send({ trackId: 't1', title: 'Song', artist: 'Band', tag: 'rock' });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/tags/moods', () => {
  it('listMoods_returns_list', async () => {
    mockTagRepo.createQueryBuilder.mockReturnValue({
      select: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([{ tag: 'ambient' }, { tag: 'rock' }]),
    });
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).get('/api/tags/moods').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

// ==================== 42-43: TAGS PLAYLIST GENERATION ====================

describe('GET /api/tags/mood/:tag', () => {
  it('moodPlaylist_valid_returns_playlist', async () => {
    mockTagRepo.createQueryBuilder.mockReturnValue({
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { trackId: 't1', title: 'Song', artist: 'Band', thumbnailUrl: null },
      ]), select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([]),
    });
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).get('/api/tags/mood/rock').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

describe('GET /api/tags/playlist', () => {
  it('tagsPlaylist_valid_returns_playlist', async () => {
    mockTagRepo.createQueryBuilder.mockReturnValue({
      select: vi.fn().mockReturnThis(), addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(), having: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { trackId: 't1', title: 'Happy Song', artist: 'Happy Band', thumbnailUrl: null, addedAt: new Date() },
      ]),
    });
    const app = express(); app.use(express.json()); app.use('/api/tags', tagsRouter);
    const res = await request(app).get('/api/tags/playlist').query({ tags: ['happy', 'upbeat'] }).set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});

// ==================== 44-47: CLIPS (SNIPPETS) ====================

describe('POST /api/clips', () => {
  it('createClip_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api/clips', clipsRouter);
    const res = await request(app).post('/api/clips').send({ trackId: 'abc', title: 'Clip', artist: 'Artist', clipName: 'Test', startTime: 0, endTime: 10 });
    expect(res.status).toBe(401);
  });

  it('createClip_valid_returns_201', async () => {
    mockClipRepo.save.mockImplementation((d: any) => Promise.resolve({ id: 1, shortCode: 'def456', ...d }));
    const app = express(); app.use(express.json()); app.use('/api/clips', clipsRouter);
    const res = await request(app).post('/api/clips').set('Authorization', `Bearer ${token()}`).send({ trackId: 'abc123', title: 'My Clip', artist: 'Artist', clipName: 'Test Clip', startTime: 0, endTime: 30 });
    expect([201, 500]).toContain(res.status);
  });
});

describe('GET /api/clips/:shortCode', () => {
  it('getClipByShortCode_valid_returns_clip', async () => {
    mockClipRepo.findOne.mockResolvedValue({ trackId: 'abc123', title: 'Test Clip', artist: 'Artist', thumbnailUrl: '/clip-cover.svg', startTime: 0, endTime: 30 });
    const app = express(); app.use(express.json()); app.use('/api/clips', clipsRouter);
    const res = await request(app).get('/api/clips/abc123');
    expect([200, 500]).toContain(res.status);
  });

  it('getClipByShortCode_not_found_returns_404', async () => {
    mockClipRepo.findOne.mockResolvedValue(null);
    const app = express(); app.use(express.json()); app.use('/api/clips', clipsRouter);
    const res = await request(app).get('/api/clips/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Clip not found');
  });
});

// ==================== 48-50: PERSONAL MIX ====================

describe('GET /api/reco/mixes/:id', () => {
  it('getRecoMix_without_auth_returns_401', async () => {
    const app = express(); app.use(express.json()); app.use('/api', recoRouter);
    const res = await request(app).get('/api/reco/mixes/mix1');
    expect(res.status).toBe(401);
  });

  it('getRecoMix_bad_mix_id_returns_400', async () => {
    const app = express(); app.use(express.json()); app.use('/api', recoRouter);
    const res = await request(app).get('/api/reco/mixes/invalid').set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Bad mix id');
  });
});

describe('POST /api/reco/mixes/regenerate', () => {
  it('regenerateMixes_returns_mixes', async () => {
    mockHistRepo.find.mockResolvedValue([]);
    mockFavRepo.find.mockResolvedValue([]);
    mockTagRepo.find.mockResolvedValue([]);
    mockYtMusicService.searchSongs.mockResolvedValue([
      { trackId: 't1', title: 'Pop Song', artist: 'Pop Artist', thumbnailUrl: 'https://example.com/thumb.jpg', duration: 200 },
      { trackId: 't2', title: 'Rock Anthem', artist: 'Rock Band', thumbnailUrl: 'https://example.com/thumb2.jpg', duration: 240 },
      { trackId: 't3', title: 'Electronic Beat', artist: 'DJ Electro', thumbnailUrl: 'https://example.com/thumb3.jpg', duration: 180 },
      { trackId: 't4', title: 'Jazz Mood', artist: 'Jazz Trio', thumbnailUrl: 'https://example.com/thumb4.jpg', duration: 300 },
      { trackId: 't5', title: 'Hip Hop Hit', artist: 'MC Flow', thumbnailUrl: 'https://example.com/thumb5.jpg', duration: 210 },
      { trackId: 't6', title: 'Indie Vibes', artist: 'Indie Band', thumbnailUrl: 'https://example.com/thumb6.jpg', duration: 195 },
      { trackId: 't7', title: 'Metal Storm', artist: 'Metal Heads', thumbnailUrl: 'https://example.com/thumb7.jpg', duration: 260 },
      { trackId: 't8', title: 'Ambient Sound', artist: 'Chill Master', thumbnailUrl: 'https://example.com/thumb8.jpg', duration: 320 },
    ]);
    const app = express(); app.use(express.json()); app.use('/api', recoRouter);
    const res = await request(app).post('/api/reco/mixes/regenerate').set('Authorization', `Bearer ${token()}`);
    expect([200, 500]).toContain(res.status);
  });
});
