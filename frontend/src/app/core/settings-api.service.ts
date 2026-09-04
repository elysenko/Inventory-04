import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { ServiceSettings } from './models';

/**
 * Client for `/api/admin/settings` — the provisioned backing services (PostgreSQL,
 * MinIO) and their credential keys. Values are write-only: the API returns a masked
 * rendering and never the plaintext, so a saved secret cannot be read back out.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiService);

  list(): Observable<ServiceSettings[]> {
    return this.api.get<ServiceSettings[]>('/admin/settings');
  }

  /** Keys outside the server's allowlist are rejected with 400 rather than ignored. */
  update(values: Record<string, string>): Observable<{ updated: string[] }> {
    return this.api.patch<{ updated: string[] }>('/admin/settings', values);
  }
}
