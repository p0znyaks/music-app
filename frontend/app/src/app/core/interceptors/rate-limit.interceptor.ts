import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, retry, throwError, timer } from 'rxjs';

function parseRetryAfterMs(err: HttpErrorResponse): number {
  const value = err.headers.get('Retry-After');
  if (!value) {
    return 0;
  }
  const seconds = Number.parseInt(value, 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  const dateMs = Date.parse(value);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return 0;
}

function isRetryable429(err: unknown): err is HttpErrorResponse {
  return err instanceof HttpErrorResponse && err.status === 429;
}

export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
  const safeMethod = req.method === 'GET' || req.method === 'HEAD';
  if (!safeMethod) {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: 2,
      delay: (err, attempt) => {
        if (!isRetryable429(err)) {
          throw err;
        }
        const retryAfter = parseRetryAfterMs(err);
        const backoff = Math.min(300 * Math.pow(2, attempt), 2000);
        const jitter = Math.floor(Math.random() * 200);
        return timer(Math.max(retryAfter, backoff + jitter));
      },
    }),
    catchError((err) => throwError(() => err)),
  );
};
