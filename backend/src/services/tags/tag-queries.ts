import { AppDataSource } from '../dataSource';
import { TrackTag } from '../../entities/track-tag.entity';
import { FavoriteTrack } from '../../entities/favorite-track.entity';
import { PlaylistTrack } from '../../entities/playlist-track.entity';
import { tagEqualsSql } from './tag-normalize';
import { pruneOrphanTags } from '../library/track-lifecycle.service';

/**
 * Every database access behind the tag feature.
 *
 * Tag rules are enforced here rather than in the controller: a tag only makes
 * sense on a track the user actually saved, duplicates are compared
 * case-insensitively, and the per-track limit counts distinct tags.
 */

export type TagRow = {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  addedAt: Date | null;
};

/** Tags are only allowed on tracks in the user's library. */
export async function isTrackTaggable(userId: number, trackId: string): Promise<boolean> {
  const favorite = await AppDataSource.getRepository(FavoriteTrack).findOne({
    where: { user: { id: userId }, trackId },
    select: { id: true },
  });
  if (favorite) return true;

  return AppDataSource.getRepository(PlaylistTrack)
    .createQueryBuilder('pt')
    .innerJoin('pt.playlist', 'p')
    .where('p.user_id = :uid', { uid: userId })
    .andWhere('pt.trackId = :tid', { tid: trackId })
    .getExists();
}

/** Case-insensitive duplicate check for one track. */
export async function tagExistsOnTrack(
  userId: number,
  trackId: string,
  tagNorm: string,
): Promise<boolean> {
  const found = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('t.track_id = :tid', { tid: trackId })
    .andWhere(`${tagEqualsSql('t.tag')} = :tagNorm`, { tagNorm })
    .limit(1)
    .getOne();
  return found !== null;
}

/** Distinct tags on a track, oldest first — what the UI shows as chips. */
export async function countDistinctTagsOnTrack(userId: number, trackId: string): Promise<number> {
  const raw = await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select(`COUNT(DISTINCT ${tagEqualsSql('t.tag')})`, 'cnt')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere('t.track_id = :tid', { tid: trackId })
    .getRawOne<{ cnt: string }>();

  const count = raw?.cnt ? Number.parseInt(raw.cnt, 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

export async function deleteTrackTag(
  userId: number,
  trackId: string,
  tagNorm: string,
): Promise<void> {
  await AppDataSource.getRepository(TrackTag)
    .createQueryBuilder()
    .delete()
    .where('user_id = :uid', { uid: userId })
    .andWhere('track_id = :tid', { tid: trackId })
    .andWhere(`${tagEqualsSql('tag')} = :tagNorm`, { tagNorm })
    .execute();
}

/**
 * Tracks carrying **every** one of the given tags. Grouping on the normalized
 * tag and requiring an exact count is what makes this an intersection rather
 * than a union.
 */
export async function findTracksByTags(
  userId: number,
  tagNorms: readonly string[],
): Promise<TagRow[]> {
  if (tagNorms.length === 0) return [];

  return AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('t.track_id', 'trackId')
    .addSelect('MIN(t.title)', 'title')
    .addSelect('MIN(t.artist)', 'artist')
    .addSelect('MIN(t.thumbnail_url)', 'thumbnailUrl')
    .addSelect('MAX(t.duration)', 'duration')
    .addSelect('MIN(t.added_at)', 'addedAt')
    .where('t.user_id = :uid', { uid: userId })
    .andWhere(`${tagEqualsSql('t.tag')} IN (:...tagNorms)`, { tagNorms })
    .groupBy('t.track_id')
    .having(`COUNT(DISTINCT ${tagEqualsSql('t.tag')}) = :n`, {
      n: tagNorms.length,
    })
    .getRawMany<TagRow>();
}

export type DistinctTagRow = {
  tag: string;
  createdAt: Date | null;
  usageCount: number;
};

/**
 * Tag list with usage counts. `sort` is validated by the caller: `alpha` orders
 * by label, `createdAt` by the most recent first use.
 */
export async function listDistinctTags(
  userId: number,
  sort: 'alpha' | 'createdAt',
): Promise<DistinctTagRow[]> {
  // Reading the tag list is the moment a stale tag becomes visible, so this is
  // where the "a tag never outlives its track" invariant is restored.
  await pruneOrphanTags(userId);

  const normalized = tagEqualsSql('t.tag');
  const qb = AppDataSource.getRepository(TrackTag)
    .createQueryBuilder('t')
    .select('MIN(t.tag)', 'tag')
    .addSelect('MIN(t.added_at)', 'createdAt')
    .addSelect('COUNT(DISTINCT t.track_id)', 'usageCount')
    .where('t.user_id = :uid', { uid: userId })
    .groupBy(normalized);

  if (sort === 'alpha') {
    qb.orderBy(`MIN(${normalized})`, 'ASC');
  } else {
    qb.orderBy('MIN(t.added_at)', 'DESC');
  }

  const raw = await qb.getRawMany<{
    tag: string;
    createdAt: Date | null;
    usageCount: string;
  }>();
  return raw.map((row) => ({
    tag: row.tag,
    createdAt: row.createdAt,
    usageCount: Number.parseInt(row.usageCount, 10) || 0,
  }));
}

export async function listTagsForTrack(userId: number, trackId: string): Promise<TrackTag[]> {
  return AppDataSource.getRepository(TrackTag).find({
    where: { user: { id: userId }, trackId },
    order: { addedAt: 'ASC' },
  });
}
