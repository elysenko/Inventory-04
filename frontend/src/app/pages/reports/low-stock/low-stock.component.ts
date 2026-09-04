import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { ReportsApi } from '../../../core/reports-api.service';
import type { LowStockRow } from '../../../core/models';

@Component({
  selector: 'app-low-stock',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  private readonly reportsApi = inject(ReportsApi);
  private readonly destroyRef = inject(DestroyRef);

  /** `GET /api/reports/low-stock` — items whose total across every location has
   *  fallen to or below their reorder point. Manager-only on the API. */
  readonly rows = signal<LowStockRow[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** The report already arrives ordered by shortfall; re-sorting keeps that
   *  guarantee local to the view. */
  readonly sorted = computed(() => [...this.rows()].sort((a, b) => b.shortfall - a.shortfall));
  readonly totalShortfall = computed(() => this.rows().reduce((sum, r) => sum + r.shortfall, 0));
  readonly atZero = computed(() => this.rows().filter((r) => r.totalQty === 0).length);

  constructor() {
    this.reportsApi
      .lowStock()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  severity(row: LowStockRow): 'critical' | 'short' | 'at-threshold' {
    if (row.totalQty === 0) return 'critical';
    return row.shortfall > 0 ? 'short' : 'at-threshold';
  }

  fillPercent(row: LowStockRow): number {
    if (row.reorderAt <= 0) return 100;
    return Math.min(100, Math.round((row.totalQty / row.reorderAt) * 100));
  }
}
