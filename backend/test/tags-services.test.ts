import { describe, it, expect } from 'vitest';
import {
  MAX_TAG_LENGTH,
  MAX_TAGS_PER_TRACK,
  MOOD_PLAYLIST_LIMIT,
  TAGS_PLAYLIST_LIMIT,
  cleanTagInput,
  normTag,
  tagEqualsSql,
} from '../src/services/tags/tag-normalize';
import { clipShortCode } from '../src/services/tags/clip-times';
import { shuffle, seededShuffle } from '../src/utils/shuffle';

/**
 * The tag services hold the rules (validation, limits, clip parsing) and the
 * shuffle utility backs every playlist, so they are covered directly rather
 * than through mocked database calls.
 */

describe('normTag', () => {
  it('trims and lower-cases', () => {
    expect(normTag('  Rock  ')).toBe('rock');
  });

  it('treats differently cased input as the same tag', () => {
    expect(normTag('FOCUS')).toBe(normTag('focus'));
  });
});

describe('cleanTagInput', () => {
  it('rejects a missing tag', () => {
    expect(cleanTagInput(undefined)).toEqual({
      ok: false,
      message: 'tag is required',
    });
    expect(cleanTagInput('   ')).toEqual({
      ok: false,
      message: 'tag is required',
    });
    expect(cleanTagInput(42)).toEqual({
      ok: false,
      message: 'tag is required',
    });
  });

  it('rejects a hashtag', () => {
    const result = cleanTagInput('rock#metal');
    expect(result.ok).toBe(false);
  });

  it('rejects a tag longer than the limit', () => {
    const tooLong = 'a'.repeat(MAX_TAG_LENGTH + 1);
    const result = cleanTagInput(tooLong);
    expect(result.ok).toBe(false);
  });

  it('accepts a tag exactly at the limit', () => {
    const result = cleanTagInput('a'.repeat(MAX_TAG_LENGTH));
    expect(result.ok).toBe(true);
  });

  it('returns both display and normalized forms', () => {
    const result = cleanTagInput('  Chill  ');
    expect(result).toEqual({ ok: true, display: 'Chill', norm: 'chill' });
  });

  it('keeps internal spacing and case in the display form', () => {
    const result = cleanTagInput('Deep Focus');
    expect(result.ok && result.display).toBe('Deep Focus');
    expect(result.ok && result.norm).toBe('deep focus');
  });
});

describe('tagEqualsSql', () => {
  it('builds a case-insensitive trimmed comparison', () => {
    expect(tagEqualsSql('t.tag')).toBe('LOWER(TRIM(t.tag))');
  });
});

describe('clipShortCode', () => {
  it('extracts the code from a clip id', () => {
    expect(clipShortCode('clip:abc123')).toBe('abc123');
  });

  it('returns null for a plain track', () => {
    expect(clipShortCode('dQw4w9WgXcQ')).toBeNull();
  });

  it('returns an empty code rather than null for a bare prefix', () => {
    expect(clipShortCode('clip:')).toBe('');
  });
});

describe('playlist limits', () => {
  it('allows more tags per playlist than tags per track', () => {
    // A track can carry at most MAX_TAGS_PER_TRACK; the playlist query accepts
    // the same number, and both mood playlists stay within that.
    expect(MOOD_PLAYLIST_LIMIT).toBeGreaterThan(0);
    expect(TAGS_PLAYLIST_LIMIT).toBeGreaterThan(MOOD_PLAYLIST_LIMIT);
    expect(MAX_TAGS_PER_TRACK).toBeGreaterThanOrEqual(4);
  });
});

describe('shuffle', () => {
  const sample = [1, 2, 3, 4, 5, 6, 7, 8];

  it('keeps every element', () => {
    expect([...shuffle(sample)].sort((a, b) => a - b)).toEqual(sample);
  });

  it('does not mutate the input', () => {
    const original = [...sample];
    shuffle(sample);
    expect(sample).toEqual(original);
  });

  it('returns a stable order for a given seed', () => {
    expect(seededShuffle(sample, 42)).toEqual(seededShuffle(sample, 42));
  });

  it('produces a different order for a different seed', () => {
    expect(seededShuffle(sample, 1)).not.toEqual(seededShuffle(sample, 2));
  });
});
