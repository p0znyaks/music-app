import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PlayerService, type PlayerTrack } from './player.service';

const track = (n: number): PlayerTrack => ({
  trackId: `id${n}`,
  title: `Track ${n}`,
  artist: 'Artist',
});

const ids = (service: PlayerService) => service.queue$.value.map((t) => t.trackId);

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlayerService);
  });

  it('starts the first track when a queue is started', () => {
    service.startQueue([track(1), track(2)]);
    expect(service.currentTrack$.value?.trackId).toBe('id1');
    expect(service.isPlaying$.value).toBe(true);
    expect(ids(service)).toEqual(['id1', 'id2']);
  });

  it('keeps every track when shuffling, only reorders them', () => {
    service.startQueue([track(1), track(2), track(3), track(4)], { shuffle: true });
    expect([...ids(service)].sort()).toEqual(['id1', 'id2', 'id3', 'id4']);
  });

  it('pauses instead of playing when the queue is empty', () => {
    service.startQueue([]);
    expect(service.currentTrack$.value).toBeNull();
    expect(service.isPlaying$.value).toBe(false);
  });

  it('records the queue source so the player bar can label it', () => {
    service.startQueue([track(1)], { source: 'history' });
    expect(service.queueSource$.value).toBe('history');
  });

  it('advances with next() and stops at the end of the queue', () => {
    service.startQueue([track(1), track(2)]);
    service.next();
    expect(service.currentTrack$.value?.trackId).toBe('id2');
    service.next();
    // Last track reached: playback ends rather than wrapping around.
    expect(service.isPlaying$.value).toBe(false);
    expect(service.hasNext()).toBe(false);
  });

  it('stays on the first track when prev() is called at the start', () => {
    service.startQueue([track(1), track(2)]);
    service.prev();
    expect(service.currentTrack$.value?.trackId).toBe('id1');
  });

  it('keeps the current track playing after a drag-reorder', () => {
    service.startQueue([track(1), track(2), track(3)]);
    service.next(); // now on id2
    service.moveQueueItem(2, 0); // drag id3 to the front
    expect(ids(service)).toEqual(['id3', 'id1', 'id2']);
    // The queue moved, but playback must not jump to the reordered head.
    expect(service.currentTrack$.value?.trackId).toBe('id2');
  });

  it('ignores a reorder that targets the same position', () => {
    service.startQueue([track(1), track(2)]);
    service.moveQueueItem(1, 1);
    expect(ids(service)).toEqual(['id1', 'id2']);
  });

  it('clamps progress to 0..100', () => {
    service.setProgressPercent(-10);
    expect(service.progress$.value).toBe(0);
    service.setProgressPercent(150);
    expect(service.progress$.value).toBe(100);
  });

  it('clears everything on reset', () => {
    service.startQueue([track(1), track(2)]);
    service.reset();
    expect(service.currentTrack$.value).toBeNull();
    expect(service.queue$.value).toEqual([]);
    expect(service.isPlaying$.value).toBe(false);
    expect(service.progress$.value).toBe(0);
  });
});
