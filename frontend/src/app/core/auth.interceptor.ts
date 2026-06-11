import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const isLogin = req.url.includes('/auth/login');
  const isRefresh = req.url.includes('/auth/refresh');
  const isPublic = req.url.includes('/public/');

  const authedReq = req.clone({ withCredentials: true });

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isLogin && !isPublic && !isRefresh) {
        return http.post(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
          switchMap(() => next(authedReq)),
          catchError(() => {
            sessionStorage.removeItem('user');
            router.navigateByUrl('/login');
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
