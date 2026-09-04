/**
 * Resolves the REST base for the NestJS API.
 *
 * The backend mounts every route under a global `/api` prefix and nginx proxies
 * that prefix straight through to it, so the SPA never needs an absolute origin
 * (which would also break CORS/cookies between environments). The base href is
 * honoured because preview builds are served from `/<id>/` while production is
 * served from `/` — index.html rewrites the <base> tag before any bundle runs,
 * so reading it here yields the right prefix in both layouts.
 */
function resolveApiUrl(): string {
  if (typeof document === 'undefined') return '/api';
  const href = document.querySelector('base')?.getAttribute('href') ?? '/';
  return `${href.replace(/\/+$/, '')}/api`;
}

/** e.g. `/api` at the root, `/abc123/api` under a preview sub-path. */
export const API_URL = resolveApiUrl();

/** True for requests this app owns — used to scope the auth header and 401 handling. */
export function isApiRequest(url: string): boolean {
  return url.startsWith(API_URL) || url.startsWith('/api');
}
