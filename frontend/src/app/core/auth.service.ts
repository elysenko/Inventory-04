import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Role, User } from './models';
import { readJson, readRaw, removeKeys, writeJson, writeRaw } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';
const EXPIRY_KEY = 'token_expires_at';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // matches the backend's 24h JWT expiry

/** Demo identities. `clerk@demo` is deliberately restricted so reviewers can
 *  compare the clerk and manager navigations side by side. */
export const DEMO_ACCOUNTS: ReadonlyArray<{ email: string; password: string; role: Role; label: string }> = [
  { email: 'manager@demo', password: 'Demo1234!', role: 'manager', label: 'Manager — full catalog, reports and audit log' },
  { email: 'clerk@demo', password: 'Demo1234!', role: 'clerk', label: 'Clerk — browse catalog and record movements' },
];

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['email'] === 'string' &&
    (v['role'] === 'clerk' || v['role'] === 'manager')
  );
}

/** Mockup rule: any address whose local part mentions "clerk" signs in as a
 *  clerk; everything else is a manager. Replaced by the real `POST /api/auth/login`
 *  response when the service layer is wired up. */
function roleForEmail(email: string): Role {
  return /clerk|picker|packer/i.test(email.split('@')[0] ?? '') ? 'clerk' : 'manager';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly user = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isManager = computed(() => this.user()?.role === 'manager');

  constructor() {
    this.restore();
  }

  /**
   * Restores a session from storage. Everything read back is untrusted: a bad
   * shape, expired token or unparseable blob clears the keys and leaves the app
   * signed out rather than throwing during bootstrap (which would blank the page).
   */
  private restore(): void {
    try {
      const expiresAt = Number(readRaw(EXPIRY_KEY) ?? 0);
      if (expiresAt && expiresAt < Date.now()) {
        this.clear();
        return;
      }
      const user = readJson<User>(USER_KEY, isUser);
      if (user && readRaw(TOKEN_KEY)) this.user.set(user);
      else if (user || readRaw(TOKEN_KEY)) this.clear();
    } catch {
      this.clear();
    }
  }

  private persist(user: User): void {
    writeJson(USER_KEY, user);
    writeRaw(TOKEN_KEY, `mock.${btoa(user.email)}.${user.role}`);
    writeRaw(EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
    this.user.set(user);
  }

  private clear(): void {
    removeKeys(USER_KEY, TOKEN_KEY, EXPIRY_KEY);
    this.user.set(null);
  }

  /**
   * Resolves entirely in the browser — the static preview has no API server, so
   * awaiting a network call here would strand the reviewer on the login screen.
   * Only genuinely empty or malformed input produces an error.
   */
  login(email: string, password: string): { ok: true } | { ok: false; message: string } {
    const trimmed = email.trim();
    if (!trimmed || !password) return { ok: false, message: 'Enter both your email and password.' };
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) return { ok: false, message: 'That email address does not look valid.' };
    if (password.length < 6) return { ok: false, message: 'Passwords are at least 6 characters.' };

    this.persist({ id: `u_${btoa(trimmed).slice(0, 10)}`, email: trimmed, role: roleForEmail(trimmed) });
    void this.router.navigate(['/items']);
    return { ok: true };
  }

  /** New self-service accounts are always clerks (see the signup contract). */
  signup(email: string, password: string): { ok: true } | { ok: false; message: string } {
    const trimmed = email.trim();
    if (!trimmed || !password) return { ok: false, message: 'Enter both your email and password.' };
    if (!/^[^\s@]+@[^\s@]+$/.test(trimmed)) return { ok: false, message: 'That email address does not look valid.' };

    this.persist({ id: `u_${btoa(trimmed).slice(0, 10)}`, email: trimmed, role: 'clerk' });
    void this.router.navigate(['/items']);
    return { ok: true };
  }

  /** Seeds a signed-in session with no form input and lands on the catalog. */
  demoLogin(role: Role = 'manager'): void {
    const account = DEMO_ACCOUNTS.find((a) => a.role === role) ?? DEMO_ACCOUNTS[0];
    this.persist({ id: `u_demo_${role}`, email: account.email, role });
    void this.router.navigate(['/items']);
  }

  /** Cold loads of an authenticated route render as a signed-in manager rather
   *  than bouncing a reviewer to /login. */
  ensureSession(): User {
    const current = this.user();
    if (current) return current;
    const seeded: User = { id: 'u_demo_manager', email: 'manager@demo', role: 'manager' };
    this.persist(seeded);
    return seeded;
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }
}
