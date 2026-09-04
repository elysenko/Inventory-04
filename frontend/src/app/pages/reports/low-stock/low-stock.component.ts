import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
  /** Backend-owned data. Wired to GET /api/reports/low-stock by the service layer. */
  readonly rows = signal<LowStockRow[]>([
    { item: { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box' }, totalQty: 18, reorderAt: 40, shortfall: 22 },
    { item: { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll' }, totalQty: 7, reorderAt: 12, shortfall: 5 },
    { item: { id: 'itm_3', sku: 'WSH-M8', name: 'Flat Washer M8', unit: 'box' }, totalQty: 24, reorderAt: 25, shortfall: 1 },
    { item: { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box' }, totalQty: 15, reorderAt: 15, shortfall: 0 },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** The report is ordered by the largest gap to the reorder point first. */
  readonly sorted = computed(() => [...this.rows()].sort((a, b) => b.shortfall - a.shortfall));
  readonly totalShortfall = computed(() => this.rows().reduce((sum, r) => sum + r.shortfall, 0));
  readonly atZero = computed(() => this.rows().filter((r) => r.totalQty === 0).length);

  severity(row: LowStockRow): 'critical' | 'short' | 'at-threshold' {
    if (row.totalQty === 0) return 'critical';
    return row.shortfall > 0 ? 'short' : 'at-threshold';
  }

  fillPercent(row: LowStockRow): number {
    if (row.reorderAt <= 0) return 100;
    return Math.min(100, Math.round((row.totalQty / row.reorderAt) * 100));
  }
}
