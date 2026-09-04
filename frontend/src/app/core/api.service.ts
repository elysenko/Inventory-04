import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_URL } from './api-url';
import type { ApiError } from './models';

export type QueryValue = string | number | boolean | null | undefined;

/**
 * Normalises anything HttpClient can reject with into the single `{ status, message }`
 * shape the screens render. The API answers every 400/401/403 with a `{ message }`
 * envelope (Nest's exception filter plus the custom validation exceptionFactory), so
 * the server's own wording is preferred; the fallbacks only cover transport failures
 * where there is no body at all.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    return { status: error.status, message: messageFrom(error) };
  }
  if (error instanceof Error && error.message) {
    return { status: 0, message: error.message };
  }
  return { status: 0, message: 'Something went wrong. Please try again.' };
}

/** Convenience for templates/components that only need the sentence. */
export function apiErrorMessage(error: unknown): string {
  return toApiError(error).message;
}

function messageFrom(error: HttpErrorResponse): string {
  const body: unknown = error.error;

  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) {
    return body.trim();
  }
  if (body && typeof body === 'object') {
    const raw = (body as Record<string, unknown>)['message'];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    // Nest can still emit string[] for exceptions raised outside the global pipe.
    if (Array.isArray(raw) && raw.length > 0) return raw.map(String).join(' ');
  }
  if (error.status === 0) {
    return 'Cannot reach the StockRoom API. Check that the backend service is running.';
  }
  if (error.status === 403) return 'Your role does not allow that action.';
  if (error.status === 404) return 'That record no longer exists.';
  return `The request failed (HTTP ${error.status}).`;
}

/**
 * Thin transport over HttpClient: prefixes `/api`, drops empty query params (an
 * unset Angular select emits '', which the API would otherwise treat as a filter
 * for the empty string) and rethrows a normalised ApiError.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  readonly baseUrl = API_URL;

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http
      .get<T>(this.url(path), { params: toParams(query) })
      .pipe(catchError(rethrow));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body).pipe(catchError(rethrow));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body).pipe(catchError(rethrow));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path)).pipe(catchError(rethrow));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

function toParams(query?: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  if (!query) return params;
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

function rethrow(error: unknown): Observable<never> {
  return throwError(() => error);
}
