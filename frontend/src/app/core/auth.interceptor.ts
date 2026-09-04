import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { isApiRequest } from './api-url';
import { SessionStore } from './session.store';

/** Login and signup are the two API calls that must go out unauthenticated. */
function isCredentialExchange(url: string): boolean {
  return /\/auth\/(login|signup)(\?|$)/.test(url);
}

/**
 * Attaches the bearer token to StockRoom API calls and turns a 401 into a clean
 * sign-out. Every backend route is guarded by default (JwtAuthGuard is registered
 * as an APP_GUARD), so a 401 means the token is missing or expired — keeping a
 * stale session in memory would leave the shell rendering manager-only nav for a
 * user the API no longer recognises.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  const ours = isApiRequest(req.url);
  const credentialExchange = isCredentialExchange(req.url);
  const token = session.token();

  const request =
    ours && token && !credentialExchange
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && ours && !credentialExchange) {
        const returnUrl = router.url;
        session.clear();
        void router.navigate(['/login'], {
          queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {},
        });
      }
      return throwError(() => error);
    }),
  );
};
