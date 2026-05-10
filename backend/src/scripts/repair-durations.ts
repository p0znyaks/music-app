import 'reflect-metadata';
import { AppDataSource } from '../services/dataSource';
import { FavoriteTrack } from '../entities/favorite-track.entity';
import { PlaylistTrack } from '../entities/playlist-track.entity';
import { Playlist } from '../entities/playlist.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { ListenHistory } from '../entities/listen-history.entity';
import { TrackTag } from '../entities/track-tag.entity';
import { Clip } from '../entities/clip.entity';
import { UserMixPreferences } from '../entities/user-mix-preferences.entity';
import { ytdlpService } from '../services/ytdlp.service';

function normalizeDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value > 24 * 60 * 60) {
    return Math.max(1, Math.round(value / 1000));
  }
  return Math.max(1, Math.round(value));
}

async function main(): Promise<void> {
  const forceAll = process.argv.includes('--all');

  AppDataSource.setOptions({
    entities: [Role, User, Playlist, PlaylistTrack, FavoriteTrack, ListenHistory, TrackTag, Clip, UserMixPreferences],
    synchronize: false,
  });
  await AppDataSource.initialize();

  const favRepo = AppDataSource.getRepository(FavoriteTrack);
  const plRepo = AppDataSource.getRepository(PlaylistTrack);

  const [favRows, plRows] = await Promise.all([
    favRepo
      .createQueryBuilder('f')
      .select('DISTINCT f.track_id', 'trackId')
      .where(forceAll ? '1=1' : '(f.duration IS NULL OR f.duration <= 0)')
      .getRawMany<{ trackId: string }>(),
    plRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.track_id', 'trackId')
      .where(forceAll ? '1=1' : '(p.duration IS NULL OR p.duration <= 0)')
      .getRawMany<{ trackId: string }>(),
  ]);

  const trackIds = [...new Set([...favRows, ...plRows].map((r) => r.trackId).filter((v) => typeof v === 'string' && v.trim()))];
  console.log(`Found ${trackIds.length} unique tracks to repair${forceAll ? ' (mode: all)' : ''}.`);

  let resolved = 0;
  let updatedFav = 0;
  let updatedPl = 0;
  let skipped = 0;

  for (const trackId of trackIds) {
    try {
      const meta = await ytdlpService.getMetadata(trackId);
      const duration = normalizeDurationSeconds(meta.duration);
      if (!duration) {
        skipped += 1;
        continue;
      }

      const favUpdate = await favRepo
        .createQueryBuilder()
        .update(FavoriteTrack)
        .set({ duration })
        .where('track_id = :trackId', { trackId })
        .andWhere(forceAll ? '1=1' : '(duration IS NULL OR duration <= 0)')
        .execute();

      const plUpdate = await plRepo
        .createQueryBuilder()
        .update(PlaylistTrack)
        .set({ duration })
        .where('track_id = :trackId', { trackId })
        .andWhere(forceAll ? '1=1' : '(duration IS NULL OR duration <= 0)')
        .execute();

      resolved += 1;
      updatedFav += favUpdate.affected ?? 0;
      updatedPl += plUpdate.affected ?? 0;
      console.log(`[${resolved}/${trackIds.length}] ${trackId} -> ${duration}s`);
    } catch (err) {
      skipped += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Skip ${trackId}: ${message}`);
    }
  }

  console.log('Repair finished.');
  console.log(`Resolved tracks: ${resolved}`);
  console.log(`Updated favorites rows: ${updatedFav}`);
  console.log(`Updated playlist rows: ${updatedPl}`);
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
