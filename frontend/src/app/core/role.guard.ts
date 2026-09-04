import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import type { Role } from './models';

/**
 * Restricts a route to a single role, mirroring the API's RolesGuard so a clerk
 * never reaches a screen whose every request would 403. Denied users land on
 * /items exactly once — /items itself carries only `authGuard`, so no redirect
 * loop is possible.
 */
export function roleGuard(role: Role): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.user();
    if (!user) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
    if (user.role === role) return true;
    return router.createUrlTree(['/items'], { queryParams: { denied: role } });
  };
}
