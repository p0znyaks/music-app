/**
 * Reading route parameters.
 *
 * Express types a path parameter as `string | string[] | undefined`: a
 * repeated parameter such as `/tag/:tag` arrives as an array. Track and tag ids
 * are percent-encoded (clip ids especially), so decoding happens here too, in
 * one place, rather than being remembered at each call site.
 */

/** First value of a route parameter, percent-decoded. */
export function routeParam(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";

  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape is a bad request, not a crash.
    return value;
  }
}

/** Route parameter as an integer, or null when it is not one. */
export function routeId(raw: string | string[] | undefined): number | null {
  const value = routeParam(raw).trim();
  if (!value) return null;
  const id = Number.parseInt(value, 10);
  return Number.isFinite(id) ? id : null;
}

/** Reads the `?force=1` confirmation flag used by destructive endpoints. */
export function wantsForce(query: unknown): boolean {
  const value = (query as { force?: unknown } | undefined)?.force;
  return value === "1" || value === "true";
}
