import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Item } from './models';

export interface ItemPayload {
  sku: string;
  name: string;
  description?: string;
  unit: string;
  reorderAt: number;
}

export interface ItemQuery {
  q?: string;
  lowStock?: boolean;
}

/** Client for `/api/items`. Reads are open to both roles; writes are manager-only server-side. */
@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private readonly api = inject(ApiService);

  /** `totalQty` is summed server-side from every StockLevel row — never stored on the item. */
  list(query: ItemQuery = {}): Observable<Item[]> {
    return this.api.get<Item[]>('/items', { q: query.q, lowStock: query.lowStock });
  }

  /** Detail additionally carries the per-location `stockLevels` breakdown. */
  get(id: string): Observable<Item> {
    return this.api.get<Item>(`/items/${encodeURIComponent(id)}`);
  }

  create(payload: ItemPayload): Observable<Item> {
    return this.api.post<Item>('/items', payload);
  }

  update(id: string, payload: Partial<ItemPayload>): Observable<Item> {
    return this.api.patch<Item>(`/items/${encodeURIComponent(id)}`, payload);
  }

  /** Refused with 400 while stock or movement history exists — the audit trail is never orphaned. */
  remove(id: string): Observable<{ id: string; deleted: true }> {
    return this.api.delete<{ id: string; deleted: true }>(`/items/${encodeURIComponent(id)}`);
  }
}
