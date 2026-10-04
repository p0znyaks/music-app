import 'reflect-metadata';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Playlist } from '../entities/playlist.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { Clip } from '../entities/clip.entity';
import { getTrackMedia, updateDurationsWhereMissing } from '../services/track-media.service';
import { connectRedis } from '../services/redis';

/**
 * Backfills durations on rows written before they were resolved on write.
 *
 * New rows always carry a length (see `completeTrackMedia`), so this only
 * matters for existing data. Read with `--all` to re-fetch every track.
 */
async function main(): Promise<void> {
  const forceAll = process.argv.includes('--all');

  // Track metadata is cached in Redis, so the client has to exist before any lookup.
  connectRedis();

  AppDataSource.setOptions({
    entities: [Role, User, Playlist, PlaylistTrack, FavoriteTrack, ListenHistory, TrackTag, Clip],
    synchronize: false,
  });
  await AppDataSource.initialize();

  const condition = forceAll ? '1=1' : '(duration IS NULL OR duration <= 0)';

  const repositories = [
    AppDataSource.getRepository(FavoriteTrack),
    AppDataSource.getRepository(PlaylistTrack),
    AppDataSource.getRepository(ListenHistory),
  ];

  const perRepo = await Promise.all(
    repositories.map(async (repo) => {
      const rows = await repo
        .createQueryBuilder()
        .select('DISTINCT track_id', 'trackId')
        .where(condition)
        .getRawMany<{ trackId: string }>();
      return rows
        .map((row) => row.trackId)
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    }),
  );

  const trackIds = [...new Set(perRepo.flat())];
  console.log(`Found ${trackIds.length} unique tracks to repair${forceAll ? ' (mode: all)' : ''}.`);
  if (trackIds.length === 0) {
    await AppDataSource.destroy();
    return;
  }

  const updatedPerRepo = [0, 0, 0];
  let resolved = 0;
  let skipped = 0;

  for (const trackId of trackIds) {
    try {
      const media = await getTrackMedia(trackId);
      if (media.duration == null) {
        skipped += 1;
        continue;
      }

      const duration = media.duration;
      const affected = await Promise.all(
        repositories.map((repo) =>
          forceAll
            ? repo
                .createQueryBuilder()
                .update()
                .set({ duration })
                .where('track_id = :trackId', { trackId })
                .execute()
                .then((result) => result.affected ?? 0)
            : updateDurationsWhereMissing(repo, trackId, duration),
        ),
      );

      resolved += 1;
      affected.forEach((count, index) => {
        updatedPerRepo[index] = (updatedPerRepo[index] ?? 0) + count;
      });
      console.log(`[${resolved}/${trackIds.length}] ${trackId} -> ${duration}s`);
    } catch (err) {
      skipped += 1;
      console.warn(`Skip ${trackId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log('Repair finished.');
  console.log(`Resolved tracks: ${resolved}`);
  console.log(`Favorites rows updated: ${updatedPerRepo[0] ?? 0}`);
  console.log(`Playlist rows updated: ${updatedPerRepo[1] ?? 0}`);
  console.log(`History rows updated: ${updatedPerRepo[2] ?? 0}`);
  console.log(`Skipped tracks: ${skipped}`);

  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error('Repair failed:', err);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});
