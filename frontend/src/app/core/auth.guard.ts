import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guards authenticated routes. Without a session the visitor is sent to /login
 * with the URL they asked for in `returnUrl`, so the deep link is restored after
 * signing in. /login carries no guard, so no redirect loop is possible.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
