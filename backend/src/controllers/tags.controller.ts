import { Request, Response } from "express";
import { AppDataSource } from "../services/dataSource";
import { TrackTag } from "../entities/track-tag.entity";
import { User } from "../entities/user.entity";
import { completeTrackMedia } from "../services/track-media.service";
import {
  MAX_TAGS_PER_TRACK,
  cleanTagInput,
  normTag,
} from "../services/tags/tag-normalize";
import {
  countDistinctTagsOnTrack,
  deleteTrackTag,
  isTrackTaggable,
  listDistinctTags as queryDistinctTags,
  listTagsForTrack,
  tagExistsOnTrack,
} from "../services/tags/tag-queries";
import {
  buildMoodPlaylist,
  buildTagsPlaylist,
  purgeTagPlaylists,
} from "../services/tags/tag-playlists";
import { routeParam } from "../http/params";
import { pruneOrphanTags } from "../services/library/track-lifecycle.service";

/**
 * Tag endpoints.
 *
 * The handlers only validate the request and delegate: tag rules live in
 * `tag-queries`, playlists are assembled in `tag-playlists`.
 */

function requireUserId(req: Request): number | null {
  return req.user?.id === undefined ? null : req.user.id;
}

type SortOrder = "alpha" | "createdAt";

/** POST /api/tags — tags a track the user has saved. */
export async function addTag(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const { trackId, title, artist, thumbnailUrl, duration, tag } =
    req.body ?? {};
  if (typeof trackId !== "string" || !trackId.trim()) {
    return res.status(400).json({ message: "trackId is required" });
  }
  if (typeof title !== "string" || typeof artist !== "string") {
    return res.status(400).json({ message: "title and artist are required" });
  }

  const cleaned = cleanTagInput(tag);
  if (!cleaned.ok) return res.status(400).json({ message: cleaned.message });

  const id = trackId.trim();

  // The three checks only read, so one round trip covers all of them.
  const [taggable, alreadyTagged, tagCount] = await Promise.all([
    isTrackTaggable(userId, id),
    tagExistsOnTrack(userId, id, cleaned.norm),
    countDistinctTagsOnTrack(userId, id),
  ]);

  // Reported in order of how fundamental the rule is.
  if (!taggable) {
    return res.status(403).json({
      message: "Tags can be added only to tracks in playlists or favorites",
    });
  }
  if (alreadyTagged) {
    return res
      .status(409)
      .json({ message: "Tag already exists for this track" });
  }
  if (tagCount >= MAX_TAGS_PER_TRACK) {
    return res
      .status(409)
      .json({ message: `A track can have up to ${MAX_TAGS_PER_TRACK} tags` });
  }

  // The tag row stores the length itself, so building a playlist by mood never
  // has to reach into the favorites and playlist tables.
  const media = await completeTrackMedia({
    trackId: id,
    thumbnailUrl,
    duration,
  });

  // Adding a tag is also a good moment to clear tags left over from a track that
  // disappeared through some other path.
  await pruneOrphanTags(userId).catch(() => 0);

  const repo = AppDataSource.getRepository(TrackTag);
  const row = repo.create({
    user: { id: userId } as User,
    trackId: id,
    title,
    artist,
    thumbnailUrl: media.thumbnailUrl,
    duration: media.duration,
    tag: cleaned.display,
  });
  await repo.save(row);

  // The cached playlists for this user no longer reflect their tags.
  await purgeTagPlaylists(userId).catch(() => undefined);

  return res.status(201).json({
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    tag: row.tag,
    addedAt: row.addedAt,
  });
}

/** GET /api/tags — every tag row, newest first. */
/** GET /api/tags/distinct — tag labels with usage counts. */
export async function listDistinctTags(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const rawSort = (req.query as { sort?: unknown }).sort;
  const sort: SortOrder = rawSort === "alpha" ? "alpha" : "createdAt";
  if (rawSort !== undefined && rawSort !== "alpha" && rawSort !== "createdAt") {
    return res.status(400).json({ message: "Invalid sort" });
  }

  return res.json(await queryDistinctTags(userId, sort));
}

/** GET /api/tags/track/:trackId — chips on one track. */
export async function listTrackTags(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const trackId = routeParam(req.params.trackId).trim();
  if (!trackId) return res.status(400).json({ message: "trackId is required" });

  const rows = await listTagsForTrack(userId, trackId);

  const seen = new Set<string>();
  const out: { tag: string; addedAt: Date }[] = [];
  for (const row of rows) {
    const key = normTag(row.tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tag: row.tag, addedAt: row.addedAt });
  }

  return res.json(out);
}

/** DELETE /api/tags/track/:trackId/:tag */
export async function removeTrackTag(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const trackId = routeParam(req.params.trackId).trim();
  if (!trackId) return res.status(400).json({ message: "trackId is required" });

  const cleaned = cleanTagInput(routeParam(req.params.tag));
  if (!cleaned.ok) return res.status(400).json({ message: cleaned.message });

  await deleteTrackTag(userId, trackId, cleaned.norm);
  await purgeTagPlaylists(userId).catch(() => undefined);

  return res.status(204).send();
}

/** GET /api/tags/mood/:tag — playlist for a single mood. */
export async function moodPlaylist(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const cleaned = cleanTagInput(routeParam(req.params.tag));
  if (!cleaned.ok) return res.status(400).json({ message: cleaned.message });

  return res.json(await buildMoodPlaylist(userId, cleaned));
}

/** GET /api/tags/playlist?tags=a&tags=b — playlist for up to four tags. */
export async function tagsPlaylist(req: Request, res: Response) {
  const userId = requireUserId(req);
  if (userId === null) return res.status(401).json({ message: "Unauthorized" });

  const rawTags = (req.query as { tags?: unknown }).tags;
  const requested: string[] = Array.isArray(rawTags)
    ? rawTags
    : typeof rawTags === "string"
      ? [rawTags]
      : [];
  if (requested.length === 0)
    return res.status(400).json({ message: "tags is required" });
  if (requested.length > MAX_TAGS_PER_TRACK) {
    return res
      .status(400)
      .json({ message: `Up to ${MAX_TAGS_PER_TRACK} tags are allowed` });
  }

  const cleaned = requested.map((tag) => cleanTagInput(tag));
  const invalid = cleaned.find((tag) => !tag.ok);
  if (invalid) return res.status(400).json({ message: invalid.message });

  const tags = cleaned as { ok: true; display: string; norm: string }[];
  if (new Set(tags.map((tag) => tag.norm)).size !== tags.length) {
    return res.status(400).json({ message: "Duplicate tags are not allowed" });
  }

  return res.json(await buildTagsPlaylist(userId, tags));
}
