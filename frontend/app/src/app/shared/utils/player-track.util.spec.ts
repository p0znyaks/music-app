import { describe, expect, it } from 'vitest';
import { toPlayerTrack, toPlayerTracks } from './player-track.util';

const row = {
  trackId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  artist: 'Rick Astley',
  thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
  duration: 213,
};

describe('toPlayerTrack', () => {
  it('maps the fields the player needs', () => {
    expect(toPlayerTrack(row)).toEqual({
      trackId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
      duration: 213,
      startTime: undefined,
      endTime: undefined,
    });
  });

  it('turns empty strings and nulls into undefined so the UI can fall back', () => {
    const result = toPlayerTrack({ ...row, thumbnailUrl: '', duration: null });
    expect(result.thumbnailUrl).toBeUndefined();
    expect(result.duration).toBeUndefined();
  });

  it('keeps clip boundaries, so a clip still starts and ends where it should', () => {
    const result = toPlayerTrack({ ...row, startTime: 30, endTime: 75 });
    expect(result.startTime).toBe(30);
    expect(result.endTime).toBe(75);
  });

  it('normalizes durations that arrive as clock strings or milliseconds', () => {
    expect(toPlayerTrack({ ...row, duration: '3:45' }).duration).toBe(225);
    expect(toPlayerTrack({ ...row, duration: 213000 }).duration).toBe(213);
  });

  it('drops a non-positive duration instead of showing 0:00', () => {
    expect(toPlayerTrack({ ...row, duration: 0 }).duration).toBeUndefined();
    expect(toPlayerTrack({ ...row, duration: -5 }).duration).toBeUndefined();
  });
});

describe('toPlayerTracks', () => {
  it('returns an empty queue for an empty list', () => {
    expect(toPlayerTracks([])).toEqual([]);
  });

  it('preserves order, which is what the queue relies on', () => {
    const result = toPlayerTracks([
      { ...row, trackId: 'a'.repeat(11) },
      { ...row, trackId: 'b'.repeat(11) },
      { ...row, trackId: 'c'.repeat(11) },
    ]);
    expect(result.map((t) => t.trackId)).toEqual(['a'.repeat(11), 'b'.repeat(11), 'c'.repeat(11)]);
  });
});
