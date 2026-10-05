import type { PlayerTrack } from '../../core/services/player.service';
import { normalizeDurationSeconds } from './duration.util';

/**
 * Минимальная форма строки списка, из которой можно собрать трек очереди.
 * Описана структурно, чтобы принимать DTO разных экранов (favorites, album,
 * playlist, history) без дублирования маппинга в каждом компоненте.
 */
export interface PlayerTrackSource {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string | null;
  duration?: number | string | null;
  startTime?: number | null;
  endTime?: number | null;
}

/** Приводит строку списка к треку очереди: нормализует длительность и пустые строки в null. */
export function toPlayerTrack(row: PlayerTrackSource): PlayerTrack {
  return {
    trackId: row.trackId,
    title: row.title,
    artist: row.artist,
    thumbnailUrl: row.thumbnailUrl || undefined,
    duration: normalizeDurationSeconds(row.duration) ?? undefined,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
  };
}

/** То же для списка — используется, чтобы собрать очередь целиком. */
export function toPlayerTracks(rows: readonly PlayerTrackSource[]): PlayerTrack[] {
  return rows.map(toPlayerTrack);
}
