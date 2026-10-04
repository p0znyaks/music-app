import { AppDataSource } from '../dataSource';
import { FavoriteTrack } from '../../entities/favorite-track.entity';
import { PlaylistTrack } from '../../entities/playlist-track.entity';
import { TrackTag } from '../../entities/track-tag.entity';

/**
 * Tags belong to a track, and a track only exists for a user while it sits in
 * favorites or in at least one playlist. Once neither is true the track is gone,
 * so its tags must go with it — otherwise a tag would keep referring to
 * something the user can no longer play, and tag-based playlists would offer it.
 *
 * Every place that removes a track from the library goes through
 * `trackStillHasSource` and `deleteTagsForTrack`, so the rule lives in one spot
 * instead of being re-derived per controller.
 */

export type RemovalImpact = {
  /** False once the track is in neither favorites nor any playlist. */
  stillReferenced: boolean;
  /** Number of tags that would be removed with the track. */
  tagCount: number;
};

/**
 * Where a track still lives, ignoring the source it is being removed from.
 *
 * `excludeFavorite` and `excludePlaylistId` name the source whose rows are about
 * to disappear: counting them would always report the track as still present.
 */
export async function trackStillHasSource(
  userId: number,
  trackId: string,
  options: { excludeFavorite?: boolean; excludePlaylistId?: number } = {},
): Promise<boolean> {
  if (!options.excludeFavorite) {
    const favorite = await AppDataSource.getRepository(FavoriteTrack).exist({
      where: { user: { id: userId }, trackId },
    });
    if (favorite) return true;
  }

  const qb = AppDataSource.getRepository(PlaylistTrack)
    .createQueryBuilder('pt')
    .innerJoin('pt.playlist', 'p')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.trackId = :tid', { tid: trackId });

  if (options.excludePlaylistId !== undefined) {
    qb.andWhere('p.id != :pid', { pid: options.excludePlaylistId });
  }

  return qb.getExists();
}

async function countTags(userId: number, trackId: string): Promise<number> {
  return AppDataSource.getRepository(TrackTag).count({
    where: { user: { id: userId }, trackId },
  });
}

/**
 * What removing a track from one source will do to its tags.
 *
 * Pass the source being emptied in `exclude`, otherwise the track still looks
 * present and the answer is always "keep the tags".
 */
export async function assessRemoval(
  userId: number,
  trackId: string,
  exclude: { excludeFavorite?: boolean; excludePlaylistId?: number } = {},
): Promise<RemovalImpact> {
  const [stillReferenced, tagCount] = await Promise.all([
    trackStillHasSource(userId, trackId, exclude),
    countTags(userId, trackId),
  ]);
  return { stillReferenced, tagCount };
}

/** Removes the track's tags. Only valid once it has no source left. */
export async function deleteTagsForTrack(userId: number, trackId: string): Promise<void> {
  await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder()
    .delete()
    .where('user_id = :uid', { uid: userId })
    .andWhere('track_id = :tid', { tid: trackId })
    .execute();
}

/**
 * Removes tags for tracks that no longer exist anywhere in the user's library.
 *
 * Keystones usually vanish together with the row that referenced them, but a
 * playlist can be deleted through another path or imported without its tags.
 * This restores the invariant rather than assuming it.
 */
export async function pruneOrphanTags(userId: number): Promise<number> {
  const orphans = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('DISTINCT t.track_id', 'trackId')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('t.track_id NOT LIKE :clipPrefix', { clipPrefix: 'clip:%' })
    .getRawMany<{ trackId: string }>();

  let removed = 0;
  for (const row of orphans) {
    const trackId = (row.trackId ?? '').trim();
    if (!trackId) continue;
    if (await trackStillHasSource(userId, trackId)) continue;
    await deleteTagsForTrack(userId, trackId);
    removed += 1;
  }

  return removed;
}
