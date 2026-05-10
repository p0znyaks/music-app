const LIKELY_MS_THRESHOLD = 24 * 60 * 60;

function parseClockString(value: string): number | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return n;
  }
  const parts = raw.split(':').map((p) => Number(p.trim()));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) {
    return null;
  }
  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!;
  }
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }
  return null;
}

export function normalizeDurationSeconds(value: unknown): number | null {
  let raw: number | null = null;
  if (typeof value === 'number') {
    raw = Number.isFinite(value) ? value : null;
  } else if (typeof value === 'string') {
    raw = parseClockString(value);
  }
  if (raw === null || raw <= 0) {
    return null;
  }
  if (raw > LIKELY_MS_THRESHOLD) {
    return Math.round(raw / 1000);
  }
  return Math.round(raw);
}

export function formatDurationClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) {
    return '0:00';
  }
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDurationCompact(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) {
    return '0m';
  }
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}
