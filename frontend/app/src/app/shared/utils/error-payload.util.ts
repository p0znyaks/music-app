import { HttpErrorResponse } from '@angular/common/http';

/** Parsed body of a failed request, or null when it carried nothing usable. */
export type ErrorPayload = { message?: unknown; requiresConfirm?: unknown } | null;

/**
 * Extracts the JSON body of a failed request.
 *
 * Nest sends JSON, but an nginx error page or a network failure arrives as a
 * plain string, so both shapes have to be handled before the fields are read.
 */
export function parseErrorPayload(err: HttpErrorResponse): ErrorPayload {
  const body: unknown = err.error;
  if (body && typeof body === 'object') {
    return body as ErrorPayload;
  }
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body);
      return parsed && typeof parsed === 'object' ? (parsed as ErrorPayload) : null;
    } catch {
      return null;
    }
  }
  return null;
}
