import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface PlayerTrack {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl?: string | null;
  duration?: number;
  startTime?: number | null;
  endTime?: number | null;
}

@Injectable({ providedIn: 'root' })
export class PlayerService {
  readonly currentTrack$ = new BehaviorSubject<PlayerTrack | null>(null);
  readonly queue$ = new BehaviorSubject<PlayerTrack[]>([]);
  readonly isPlaying$ = new BehaviorSubject(false);
  readonly progress$ = new BehaviorSubject(0);

  private queueIndex = 0;

  private resolveQueueIndex(queue: PlayerTrack[]): number {
    if (queue.length === 0) {
      return 0;
    }
    const current = this.currentTrack$.value;
    if (!current) {
      return Math.max(0, Math.min(this.queueIndex, queue.length - 1));
    }
    const idx = queue.findIndex((t) => t.trackId === current.trackId);
    if (idx >= 0) {
      return idx;
    }
    return Math.max(0, Math.min(this.queueIndex, queue.length - 1));
  }

  play(track: PlayerTrack): void {
    this.currentTrack$.next(track);
    const q = this.queue$.value;
    const idx = q.findIndex((t) => t.trackId === track.trackId);
    this.queueIndex = idx >= 0 ? idx : 0;
    this.isPlaying$.next(true);
    this.progress$.next(0);
  }

  pause(): void {
    this.isPlaying$.next(false);
  }

  resume(): void {
    if (this.currentTrack$.value) {
      this.isPlaying$.next(true);
    }
  }

  next(): void {
    const q = this.queue$.value;
    if (q.length === 0) {
      return;
    }
    const currentIndex = this.resolveQueueIndex(q);
    const nextIndex = currentIndex + 1;
    if (nextIndex >= q.length) {
      this.queueIndex = q.length - 1;
      this.isPlaying$.next(false);
      this.progress$.next(100);
      return;
    }
    this.queueIndex = nextIndex;
    this.currentTrack$.next(q[this.queueIndex] ?? null);
    this.isPlaying$.next(true);
    this.progress$.next(0);
  }

  prev(): void {
    const q = this.queue$.value;
    if (q.length === 0) {
      return;
    }
    const currentIndex = this.resolveQueueIndex(q);
    this.queueIndex = Math.max(currentIndex - 1, 0);
    this.currentTrack$.next(q[this.queueIndex] ?? null);
    this.isPlaying$.next(true);
    this.progress$.next(0);
  }

  addToQueue(track: PlayerTrack): void {
    this.queue$.next([...this.queue$.value, track]);
  }

  /** Move item fromIndex to toIndex. Keeps queueIndex aligned with the current track. */
  moveQueueItem(fromIndex: number, toIndex: number): void {
    const q = this.queue$.value;
    if (q.length <= 1) {
      return;
    }
    const from = Math.max(0, Math.min(Math.floor(fromIndex), q.length - 1));
    const to = Math.max(0, Math.min(Math.floor(toIndex), q.length - 1));
    if (from === to) {
      return;
    }
    const next = [...q];
    const [item] = next.splice(from, 1);
    if (!item) {
      return;
    }
    next.splice(to, 0, item);
    this.queue$.next(next);

    const current = this.currentTrack$.value;
    if (!current) {
      this.queueIndex = Math.min(this.queueIndex, next.length - 1);
      return;
    }
    const idx = next.findIndex((t) => t.trackId === current.trackId);
    if (idx >= 0) {
      this.queueIndex = idx;
    }
  }

  setQueue(tracks: PlayerTrack[]): void {
    this.queue$.next([...tracks]);
    this.queueIndex = 0;
    if (tracks.length > 0) {
      this.currentTrack$.next(tracks[0] ?? null);
    } else {
      this.currentTrack$.next(null);
    }
    this.progress$.next(0);
  }

  startQueue(tracks: PlayerTrack[], options?: { shuffle?: boolean }): void {
    if (tracks.length === 0) {
      this.setQueue([]);
      this.pause();
      return;
    }
    const nextQueue = options?.shuffle ? this.shuffleTracks(tracks) : [...tracks];
    this.setQueue(nextQueue);
    const first = nextQueue[0];
    if (first) {
      this.play(first);
    }
  }

  private shuffleTracks(tracks: PlayerTrack[]): PlayerTrack[] {
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  setProgressPercent(p: number): void {
    this.progress$.next(Math.max(0, Math.min(100, p)));
  }

  reset(): void {
    this.currentTrack$.next(null);
    this.queue$.next([]);
    this.isPlaying$.next(false);
    this.progress$.next(0);
    this.queueIndex = 0;
  }
}
