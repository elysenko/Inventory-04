import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guards authenticated routes. In the static preview a cold deep link seeds a
 * demo session instead of redirecting, so every screen stays reachable at its
 * own URL. It never redirects, which keeps it provably loop-free.
 */
export const authGuard: CanActivateFn = () => {
  inject(AuthService).ensureSession();
  return true;
};
