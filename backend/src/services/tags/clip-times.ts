import { In } from "typeorm";
import { AppDataSource } from "../dataSource";
import { Clip } from "../../entities/clip.entity";

/**
 * Clip rows are stored in the user's library under the id `clip:<shortCode>`,
 * so any listing that can contain a clip has to resolve its segment boundaries
 * before handing the track to the player.
 */

const CLIP_ID_PREFIX = "clip:";

export type ClipTimes = { startTime: number; endTime: number };

/** The short code of a clip track id, or `null` for a plain track. */
export function clipShortCode(trackId: string): string | null {
  return trackId.startsWith(CLIP_ID_PREFIX)
    ? trackId.slice(CLIP_ID_PREFIX.length)
    : null;
}

/** Reads the segment boundaries for the given clip ids in one query. */
export async function loadClipTimes(
  trackIds: readonly string[],
): Promise<Map<string, ClipTimes>> {
  const codes = trackIds
    .map(clipShortCode)
    .filter((code): code is string => !!code);
  const map = new Map<string, ClipTimes>();
  if (codes.length === 0) return map;

  const clips = await AppDataSource.getRepository(Clip).find({
    where: { shortCode: In(codes) },
  });
  for (const clip of clips) {
    map.set(clip.shortCode, {
      startTime: clip.startTime,
      endTime: clip.endTime,
    });
  }
  return map;
}
