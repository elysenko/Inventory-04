import { Injectable, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { SessionStore } from './session.store';
import type { AuthResponse, Role, User } from './models';

/** Seeded demo identities (see backend/prisma/seed.ts). `clerk@demo` is deliberately
 *  restricted so reviewers can compare the clerk and manager navigations side by side. */
export const DEMO_ACCOUNTS: ReadonlyArray<{ email: string; password: string; role: Role; label: string }> = [
  { email: 'manager@demo', password: 'Demo1234!', role: 'manager', label: 'Manager — full catalog, reports and audit log' },
  { email: 'clerk@demo', password: 'Demo1234!', role: 'clerk', label: 'Clerk — browse catalog and record movements' },
];

/**
 * Session lifecycle against the real API.
 *
 * `POST /api/auth/login` and `/signup` return `{ token, user }`; the token is the
 * only thing that grants access, and the role rendered in the shell always comes
 * from the server's copy of the user — never from anything the browser guessed.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  readonly user = this.session.user.asReadonly();
  readonly isAuthenticated = computed(() => this.session.isAuthenticated());
  readonly isManager = computed(() => this.session.user()?.role === 'manager');

  get token(): string | null {
    return this.session.token();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>('/auth/login', { email: email.trim(), password })
      .pipe(tap((res) => this.accept(res)));
  }

  /** Self-service accounts are always clerks — the server assigns the role and
   *  strips any `role` sent in the body, so nothing here can elevate itself. */
  signup(email: string, password: string, name?: string): Observable<AuthResponse> {
    const trimmedName = name?.trim();
    return this.api
      .post<AuthResponse>('/auth/signup', {
        email: email.trim(),
        password,
        // The form asks for a full name, so it is sent and stored rather than
        // being collected and silently dropped.
        ...(trimmedName ? { name: trimmedName } : {}),
      })
      .pipe(tap((res) => this.accept(res)));
  }

  /** Re-reads the profile from `GET /api/auth/me`, so a role changed server-side
   *  is reflected without forcing the user to sign in again. */
  refresh(): Observable<User> {
    return this.api.get<User>('/auth/me').pipe(tap((user) => this.session.setUser(user)));
  }

  logout(): void {
    this.session.clear();
    void this.router.navigate(['/login']);
  }

  private accept(response: AuthResponse): void {
    this.session.set(response.token, response.user);
    void this.router.navigateByUrl(this.consumeReturnUrl());
  }

  /** Honours `?returnUrl=` set by the guards, so a deep link survives the sign-in detour. */
  private consumeReturnUrl(): string {
    const raw = this.router.routerState.snapshot.root.queryParamMap.get('returnUrl');
    // Only same-app paths: an absolute or protocol-relative URL would be an open redirect.
    if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login') && !raw.startsWith('/signup')) {
      return raw;
    }
    return '/items';
  }
}
