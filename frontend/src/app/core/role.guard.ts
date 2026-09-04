import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import type { Role } from './models';

/**
 * Restricts a route to a single role. Denied users are sent to /items exactly
 * once — /items itself carries only `authGuard`, so no redirect loop is possible.
 */
export function roleGuard(role: Role): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.ensureSession();
    if (user.role === role) return true;
    return router.createUrlTree(['/items'], { queryParams: { denied: role } });
  };
}
