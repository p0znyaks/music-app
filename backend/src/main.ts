import "reflect-metadata";
import express from "express";
import https from "https";
import fs from "fs";
import path from "path";
import { AppDataSource, dataSourceOptions } from "./services/dataSource";
import { createLogger } from "./logger";
import { startPythonPool } from "./services/python-pool";
import { connectRedis } from "./services/redis";
import { rewriteImageUrlsDeep } from "./services/image-proxy.service";
import { authRouter } from "./routes/auth.routes";
import { clipsRouter } from "./routes/clips.routes";
import { favoritesRouter } from "./routes/favorites.routes";
import { healthRouter } from "./routes/health.routes";
import { historyRouter } from "./routes/history.routes";
import { imageRouter } from "./routes/image.routes";
import { playlistRouter } from "./routes/playlist.routes";
import { profileRouter } from "./routes/profile.routes";
import { recoRouter } from "./routes/reco.routes";
import { searchRouter } from "./routes/search.routes";
import { tagsRouter } from "./routes/tags.routes";
import { trackRouter } from "./routes/track.routes";

const log = createLogger("main");

AppDataSource.setOptions({
  ...dataSourceOptions(),
  // Safe for a single-instance deployment: migrations are idempotent and run
  // on boot instead of letting TypeORM silently mutate the schema.
  migrationsRun: true,
});

async function bootstrap() {
  // Applies pending migrations, then connects Redis and the yt-dlp worker pool.
  await AppDataSource.initialize();

  const redis = connectRedis();
  await redis.ping();

  await startPythonPool();

  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    const rawJson = res.json.bind(res);
    res.json = ((body: unknown) =>
      rawJson(rewriteImageUrlsDeep(body))) as typeof res.json;
    next();
  });
  app.use("/api", healthRouter);
  app.use("/api", searchRouter);
  app.use("/api", imageRouter);
  app.use("/api/tracks", trackRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/playlists", playlistRouter);
  app.use("/api/history", historyRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/tags", tagsRouter);
  app.use("/api/clips", clipsRouter);
  app.use("/api/profile", profileRouter);
  app.use("/api", recoRouter);

  const port = Number(process.env.PORT) || 3000;
  const keyPath = path.resolve(__dirname, "..", "server-key.pem");
  const certPath = path.resolve(__dirname, "..", "server-cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const httpsServer = https.createServer(
      { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
      app,
    );
    httpsServer.listen(port, () => {
      log.info(`Server listening on https://localhost:${port}`);
    });
  } else {
    app.listen(port, () => {
      log.info(`Server listening on port ${port} (http)`);
    });
  }
}

bootstrap().catch((err) => {
  log.error("Failed to start", err);
  process.exit(1);
});
