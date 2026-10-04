import { Request, Response } from "express";
import { AppDataSource } from "../services/dataSource";
import { FavoriteTrack } from "../entities/favorite-track.entity";
import {
  assessRemoval,
  deleteTagsForTrack,
} from "../services/library/track-lifecycle.service";
import { User } from "../entities/user.entity";
import { completeTrackMedia } from "../services/track-media.service";
import { clipShortCode, loadClipTimes } from "../services/tags/clip-times";
import { routeParam, wantsForce } from "../http/params";

type FavoriteTrackResponse = {
  id: number;
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  duration: number | null;
  addedAt: Date;
  /** Present only for clip tracks. */
  startTime?: number;
  endTime?: number;
};

export async function addFavorite(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { trackId, title, artist, thumbnailUrl, duration } = req.body ?? {};
  if (typeof trackId !== "string" || !trackId.trim()) {
    return res.status(400).json({ message: "trackId is required" });
  }
  if (typeof title !== "string" || typeof artist !== "string") {
    return res.status(400).json({ message: "title and artist are required" });
  }

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const existing = await repo.findOne({
    where: { user: { id: userId }, trackId: trackId.trim() },
  });
  if (existing) {
    return res.status(409).json({ message: "Already in favorites" });
  }

  // Duration and artwork are resolved before the write so the stored row is
  // complete: a track saved from a clip or a pasted URL would otherwise sit in
  // the database with no length until something needed to display it.
  const media = await completeTrackMedia({ trackId, thumbnailUrl, duration });

  const row = repo.create({
    user: { id: userId } as User,
    trackId: trackId.trim(),
    title,
    artist,
    thumbnailUrl: media.thumbnailUrl,
    duration: media.duration,
  });
  await repo.save(row);

  return res.status(201).json({
    id: row.id,
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl,
    duration: row.duration,
    addedAt: row.addedAt,
  });
}

export async function removeFavorite(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const trackId = routeParam(req.params.trackId);
  if (!trackId) {
    return res.status(400).json({ message: "trackId is required" });
  }

  const force = wantsForce(req.query);

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const row = await repo.findOne({
    where: { user: { id: userId }, trackId },
  });
  if (!row) {
    return res.status(404).json({ message: "Favorite not found" });
  }

  // Removing from favorites orphans the track only if no playlist holds it.
  const impact = await assessRemoval(userId, trackId, {
    excludeFavorite: true,
  });
  if (!impact.stillReferenced && impact.tagCount > 0 && !force) {
    return res.status(409).json({
      message: "Track has tags. Confirmation required.",
      requiresConfirm: true,
      hasTags: true,
      tagCount: impact.tagCount,
    });
  }

  await repo.remove(row);

  if (!impact.stillReferenced) {
    await deleteTagsForTrack(userId, trackId);
  }

  return res.status(204).send();
}

export async function listFavorites(req: Request, res: Response) {
  const userId = req.user?.id;
  if (userId === undefined) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const repo = AppDataSource.getRepository(FavoriteTrack);
  const rows = await repo.find({
    where: { user: { id: userId } },
    order: { addedAt: "DESC" },
  });

  const clipTimes = await loadClipTimes(rows.map((row) => row.trackId));

  return res.json(
    rows.map((row) => {
      const track: FavoriteTrackResponse = {
        id: row.id,
        trackId: row.trackId,
        title: row.title,
        artist: row.artist,
        thumbnailUrl: row.thumbnailUrl,
        duration: row.duration,
        addedAt: row.addedAt,
      };

      const shortCode = clipShortCode(row.trackId);
      const clip = shortCode ? clipTimes.get(shortCode) : undefined;
      if (clip) {
        track.startTime = clip.startTime;
        track.endTime = clip.endTime;
      }
      return track;
    }),
  );
}
