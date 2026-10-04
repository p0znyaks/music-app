/**
 * Tag validation and limits.
 *
 * A tag is user input that ends up in SQL comparisons and in cache keys, so it is
 * normalized to one canonical form (`normTag`) before any lookup, and the raw
 * display form is what gets stored and shown.
 */

/** A track can carry at most this many tags. */
export const MAX_TAGS_PER_TRACK = 4;
/** Tags are short labels, not sentences; shared with the UI limit. */
export const MAX_TAG_LENGTH = 15;
/** A single-mood playlist shows at most this many tracks. */
export const MOOD_PLAYLIST_LIMIT = 30;
/** A combined multi-tag playlist shows at most this many tracks. */
export const TAGS_PLAYLIST_LIMIT = 50;

export type CleanTag = { ok: true; display: string; norm: string };
export type TagError = { ok: false; message: string };

/** Canonical form used for comparisons: trimmed and lower-cased. */
export function normTag(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Validates raw tag input and returns both forms. The `#` is rejected because
 * tags are rendered as chips rather than hashtags.
 */
export function cleanTagInput(raw: unknown): CleanTag | TagError {
  if (typeof raw !== 'string') {
    return { ok: false, message: 'tag is required' };
  }

  const display = raw.trim();
  if (!display) {
    return { ok: false, message: 'tag is required' };
  }
  if (display.includes('#')) {
    return { ok: false, message: 'tag must not include #' };
  }
  if (display.length > MAX_TAG_LENGTH) {
    return {
      ok: false,
      message: `tag must be ${MAX_TAG_LENGTH} characters or less`,
    };
  }

  return { ok: true, display, norm: normTag(display) };
}

/**
 * SQL comparison against the stored value. PostgreSQL folds case and trims
 * padding, so this matches rows written before `normTag` existed.
 */
export function tagEqualsSql(columnAlias: string): string {
  return `LOWER(TRIM(${columnAlias}))`;
}
