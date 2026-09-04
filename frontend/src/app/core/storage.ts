/**
 * Namespaced browser storage.
 *
 * Preview builds are served many-per-origin at `/<mockup_id>/`, and storage is
 * origin-scoped rather than path-scoped. Every key is therefore prefixed with
 * the first URL path segment so two mockups on the same host cannot clobber
 * each other's session. ALL storage access in the app goes through here — no
 * component may touch a bare `token` / `user` key.
 */
const NS = (typeof location !== 'undefined' && location.pathname.split('/')[1]) || 'app';

export const nsKey = (key: string): string => `${NS}:${key}`;

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: string): string | null {
  try {
    return store()?.getItem(nsKey(key)) ?? null;
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    store()?.setItem(nsKey(key), value);
  } catch {
    /* private mode / quota — the preview must keep working regardless */
  }
}

export function removeKeys(...keys: string[]): void {
  try {
    const s = store();
    for (const k of keys) s?.removeItem(nsKey(k));
  } catch {
    /* ignore */
  }
}

/** Reads and JSON-parses a key. Returns null (and self-heals) on anything unexpected. */
export function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  const raw = readRaw(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValid(parsed)) return parsed;
  } catch {
    /* fall through to cleanup */
  }
  removeKeys(key);
  return null;
}

export function writeJson(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
