import { HttpInterceptorFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

function bearerHeader(): Record<string, string> {
  const token = sessionStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const http = inject(HttpClient);
  const isLogin = req.url.includes('/auth/login');
  const isRefresh = req.url.includes('/auth/refresh');
  const isPublic = req.url.includes('/public/');

  let authedReq = req.clone({ withCredentials: true });
  if (!isLogin && !isPublic) {
    authedReq = authedReq.clone({ setHeaders: bearerHeader() });
  }

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isLogin && !isPublic && !isRefresh) {
        return http.post<{ access_token?: string }>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
          switchMap((res) => {
            if (res?.access_token) {
              sessionStorage.setItem('access_token', res.access_token);
            }
            return next(authedReq.clone({ withCredentials: true, setHeaders: bearerHeader() }));
          }),
          catchError(() => {
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('access_token');
            router.navigateByUrl('/login');
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
