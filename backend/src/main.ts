import 'reflect-metadata';
import express from 'express';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { Clip } from './entities/clip.entity';
import { FavoriteTrack } from './entities/favorite-track.entity';
import { ListenHistory } from './entities/listen-history.entity';
import { PlaylistTrack } from './entities/playlist-track.entity';
import { Playlist } from './entities/playlist.entity';
import { Role } from './entities/role.entity';
import { TrackTag } from './entities/track-tag.entity';
import { User } from './entities/user.entity';
import { AppDataSource } from './services/dataSource';
import { startPythonPool } from './services/python-pool';
import { connectRedis } from './services/redis';
import { rewriteImageUrlsDeep } from './services/image-proxy.service';
import { authRouter } from './routes/auth.routes';
import { clipsRouter } from './routes/clips.routes';
import { favoritesRouter } from './routes/favorites.routes';
import { healthRouter } from './routes/health.routes';
import { historyRouter } from './routes/history.routes';
import { imageRouter } from './routes/image.routes';
import { playlistRouter } from './routes/playlist.routes';
import { profileRouter } from './routes/profile.routes';
import { recoRouter } from './routes/reco.routes';
import { searchRouter } from './routes/search.routes';
import { tagsRouter } from './routes/tags.routes';
import { trackRouter } from './routes/track.routes';

AppDataSource.setOptions({
  entities: [
    Role,
    User,
    Playlist,
    PlaylistTrack,
    FavoriteTrack,
    ListenHistory,
    TrackTag,
    Clip,
  ],
  synchronize: true,
});

async function ensureDefaultRoles() {
  const roleRepo = AppDataSource.getRepository(Role);
  if ((await roleRepo.count()) > 0) {
    return;
  }
  await roleRepo.insert([
    { id: 1, name: 'guest' },
    { id: 2, name: 'user' },
  ]);
  await AppDataSource.query(
    `SELECT setval(
      pg_get_serial_sequence('roles', 'id'),
      COALESCE((SELECT MAX(id) FROM roles), 1)
    )`,
  );
}

async function bootstrap() {
  await AppDataSource.initialize();
  await ensureDefaultRoles();

  const redis = connectRedis();
  await redis.ping();

  await startPythonPool();

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const rawJson = res.json.bind(res);
    res.json = ((body: unknown) => rawJson(rewriteImageUrlsDeep(body))) as typeof res.json;
    next();
  });
  app.use('/api', healthRouter);
  app.use('/api', searchRouter);
  app.use('/api', imageRouter);
  app.use('/api/tracks', trackRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/playlists', playlistRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/tags', tagsRouter);
  app.use('/api/clips', clipsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api', recoRouter);

  const port = Number(process.env.PORT) || 3000;
  const keyPath = path.resolve(__dirname, '..', 'server-key.pem');
  const certPath = path.resolve(__dirname, '..', 'server-cert.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsServer = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      app,
    );
    httpsServer.listen(port, () => {
      console.log(`Server listening on https://localhost:${port}`);
    });
  } else {
    app.listen(port, () => {
      console.log(`Server listening on port ${port} (http)`);
    });
  }
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});