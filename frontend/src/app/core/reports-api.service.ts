import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { LowStockRow } from './models';

/** Client for `/api/reports`. Manager-only server-side. */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiService);

  /** Rows where the total across every location is at or below the reorder point. */
  lowStock(): Observable<LowStockRow[]> {
    return this.api.get<LowStockRow[]>('/reports/low-stock');
  }
}
