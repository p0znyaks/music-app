import { describe, expect, it } from 'vitest';
import {
  isYoutubeVideoId,
  mapFullEntry,
  normalizeQueryForCache,
  parseJsonLines,
  pickArtist,
  pickThumbnail,
} from '../src/services/ytdlp/ytdlp-parse';

describe('isYoutubeVideoId', () => {
  it('accepts real ids', () => {
    expect(isYoutubeVideoId('dQw4w9WgXcQ')).toBe(true);
  });

  it('rejects anything that is not an 11-char id', () => {
    expect(isYoutubeVideoId('')).toBe(false);
    expect(isYoutubeVideoId('short')).toBe(false);
    expect(isYoutubeVideoId('dQw4w9WgXcQextra')).toBe(false);
    expect(isYoutubeVideoId('has space')).toBe(false);
  });
});

describe('pickArtist', () => {
  it('prefers artist, then falls back to uploader and channel', () => {
    expect(pickArtist({ artist: 'A', uploader: 'U', channel: 'C' })).toBe('A');
    expect(pickArtist({ uploader: 'U', channel: 'C' })).toBe('U');
    expect(pickArtist({ channel: 'C' })).toBe('C');
  });

  it('returns an empty string when no artist field exists', () => {
    expect(pickArtist({})).toBe('');
    expect(pickArtist({ artist: '' })).toBe('');
  });
});

describe('pickThumbnail', () => {
  it('uses the flat thumbnail when present', () => {
    expect(pickThumbnail({ thumbnail: 'https://img/1.jpg' })).toBe('https://img/1.jpg');
  });

  it('falls back to the first entry of thumbnails[]', () => {
    expect(pickThumbnail({ thumbnails: [{ url: 'https://img/2.jpg' }] })).toBe('https://img/2.jpg');
  });

  it('returns an empty string for entries with no artwork', () => {
    expect(pickThumbnail({})).toBe('');
    expect(pickThumbnail({ thumbnails: [] })).toBe('');
    expect(pickThumbnail({ thumbnails: [{}] })).toBe('');
  });
});

describe('parseJsonLines', () => {
  it('parses one JSON object per line and skips blanks', () => {
    const stdout = '{"id":"a"}\n\n{"id":"b"}\n';
    expect(parseJsonLines(stdout).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('skips a malformed line instead of failing the whole batch', () => {
    const stdout = '{"id":"a"}\nnot json\n{"id":"b"}';
    expect(parseJsonLines(stdout)).toHaveLength(2);
  });

  it('returns an empty array for empty output', () => {
    expect(parseJsonLines('')).toEqual([]);
  });
});

describe('mapFullEntry', () => {
  it('maps a full yt-dlp entry onto TrackMetadata', () => {
    expect(
      mapFullEntry({
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        thumbnail: 'https://img/1.jpg',
        duration: 213,
      }),
    ).toEqual({
      trackId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      thumbnailUrl: 'https://img/1.jpg',
      duration: 213,
    });
  });

  it('reports duration 0 when upstream has none, instead of NaN', () => {
    expect(mapFullEntry({ id: 'x'.repeat(11) }).duration).toBe(0);
    expect(mapFullEntry({ id: 'x'.repeat(11), duration: 'nonsense' }).duration).toBe(0);
  });
});

describe('normalizeQueryForCache', () => {
  it('collapses casing and spacing so one search is one cache key', () => {
    expect(normalizeQueryForCache('  Rihanna   Umbrella ')).toBe('rihanna umbrella');
  });

  it('leaves an already-normalized query unchanged', () => {
    expect(normalizeQueryForCache('drake')).toBe('drake');
  });
});
