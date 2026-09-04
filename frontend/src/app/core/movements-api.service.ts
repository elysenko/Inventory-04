import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Movement, MovementType, Paginated } from './models';

export interface CreateMovementPayload {
  type: MovementType;
  itemId: string;
  fromLocId?: string | null;
  toLocId?: string | null;
  qty: number;
  note?: string;
}

export interface MovementQuery {
  itemId?: string;
  type?: MovementType | '';
  /** `YYYY-MM-DD` as the date inputs emit; widened to the whole day below. */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The date inputs emit a bare `YYYY-MM-DD`, which the API would read as midnight.
 * Anchoring `from` to the start of the day and `to` to the end of it makes both
 * bounds inclusive, so filtering "to 3 September" still returns that afternoon's
 * movements.
 */
function dayStart(date?: string): string | undefined {
  return date ? `${date}T00:00:00.000Z` : undefined;
}

function dayEnd(date?: string): string | undefined {
  return date ? `${date}T23:59:59.999Z` : undefined;
}

/** Client for `/api/movements`. POST is open to both roles; the audit log is manager-only. */
@Injectable({ providedIn: 'root' })
export class MovementsApi {
  private readonly api = inject(ApiService);

  /** Balance change and audit row are applied by the server in one transaction —
   *  a rejected movement (e.g. insufficient stock) leaves the balance untouched. */
  create(payload: CreateMovementPayload): Observable<Movement> {
    return this.api.post<Movement>('/movements', payload);
  }

  list(query: MovementQuery = {}): Observable<Paginated<Movement>> {
    return this.api.get<Paginated<Movement>>('/movements', {
      itemId: query.itemId,
      type: query.type,
      from: dayStart(query.from),
      to: dayEnd(query.to),
      page: query.page,
      pageSize: query.pageSize,
    });
  }
}
