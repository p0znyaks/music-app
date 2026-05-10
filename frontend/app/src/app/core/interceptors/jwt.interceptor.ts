import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // пропускаем proxy-stream — токен там в query параметре
  const isStream = req.url.includes('proxy-stream');

  const token = auth.getToken();
  const authReq =
    token && !isStream ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // не трогаем попытку входа — там 401 = неверный пароль
        const isLoginAttempt = req.url.includes('auth/login');
        if (!isLoginAttempt) {
          auth.logout();
          void router.navigate(['/login']);
        }
      }
      return throwError(() => err);
    }),
  );
};
