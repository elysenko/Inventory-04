import { Injectable, computed, signal } from '@angular/core';
import type { User } from './models';
import { readJson, readRaw, removeKeys, writeJson, writeRaw } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';
const EXPIRY_KEY = 'token_expires_at';

/** Matches the backend's 24h JWT expiry, so the client stops sending a token the API would reject. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['email'] === 'string' &&
    (v['role'] === 'clerk' || v['role'] === 'manager')
  );
}

/**
 * Holds the signed-in identity and its bearer token.
 *
 * Deliberately separate from AuthService: the HTTP interceptor needs the token on
 * every request, and injecting AuthService (which itself depends on HttpClient)
 * from inside an interceptor would be a circular dependency. This store depends
 * on nothing but browser storage.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly user = signal<User | null>(null);
  readonly token = signal<string | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null && this.token() !== null);

  constructor() {
    this.restore();
  }

  /**
   * Rehydrates from storage. Everything read back is untrusted: an expired token,
   * a bad shape or an unparseable blob clears the keys and leaves the app signed
   * out rather than throwing during bootstrap (which would blank the page).
   */
  private restore(): void {
    try {
      const expiresAt = Number(readRaw(EXPIRY_KEY) ?? 0);
      if (expiresAt && expiresAt < Date.now()) {
        this.clear();
        return;
      }
      const user = readJson<User>(USER_KEY, isUser);
      const token = readRaw(TOKEN_KEY);
      if (user && token) {
        this.user.set(user);
        this.token.set(token);
      } else if (user || token) {
        this.clear();
      }
    } catch {
      this.clear();
    }
  }

  set(token: string, user: User): void {
    writeRaw(TOKEN_KEY, token);
    writeJson(USER_KEY, user);
    writeRaw(EXPIRY_KEY, String(Date.now() + TOKEN_TTL_MS));
    this.token.set(token);
    this.user.set(user);
  }

  /** Refreshes the cached profile (e.g. after GET /api/auth/me) without touching the token. */
  setUser(user: User): void {
    writeJson(USER_KEY, user);
    this.user.set(user);
  }

  clear(): void {
    removeKeys(USER_KEY, TOKEN_KEY, EXPIRY_KEY);
    this.token.set(null);
    this.user.set(null);
  }
}
