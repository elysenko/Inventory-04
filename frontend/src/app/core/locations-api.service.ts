import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Location } from './models';

export interface LocationPayload {
  name: string;
  zone: string;
}

/** Client for `/api/locations`. The list is clerk-readable because the movement
 *  form's From/To selects depend on it; writes are manager-only server-side. */
@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly api = inject(ApiService);

  list(): Observable<Location[]> {
    return this.api.get<Location[]>('/locations');
  }

  get(id: string): Observable<Location> {
    return this.api.get<Location>(`/locations/${encodeURIComponent(id)}`);
  }

  create(payload: LocationPayload): Observable<Location> {
    return this.api.post<Location>('/locations', payload);
  }

  update(id: string, payload: Partial<LocationPayload>): Observable<Location> {
    return this.api.patch<Location>(`/locations/${encodeURIComponent(id)}`, payload);
  }

  remove(id: string): Observable<{ id: string; deleted: true }> {
    return this.api.delete<{ id: string; deleted: true }>(`/locations/${encodeURIComponent(id)}`);
  }
}
