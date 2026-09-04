import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth.service';
import type { Item, Movement, StockLevel } from '../../../core/models';

@Component({
  selector: 'app-item-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);

  /** Backend-owned data. Wired to GET /api/items/:id by the service layer. */
  readonly items = signal<Item[]>([
    {
      id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box', reorderAt: 40, totalQty: 18,
      description: 'Zinc-plated hex head bolt, 100 per box. Used on the pallet-racking rebuild.',
      stockLevels: [
        { id: 'sl_1', itemId: 'itm_1', locationId: 'loc_a', qty: 12, location: { id: 'loc_a', name: 'Zone A', zone: 'A' } },
        { id: 'sl_2', itemId: 'itm_1', locationId: 'loc_b', qty: 6, location: { id: 'loc_b', name: 'Zone B', zone: 'B' } },
        { id: 'sl_3', itemId: 'itm_1', locationId: 'loc_c', qty: 0, location: { id: 'loc_c', name: 'Zone C', zone: 'C' } },
      ],
    },
    {
      id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box', reorderAt: 30, totalQty: 96,
      description: 'Zinc-plated hex nut, 200 per box.',
      stockLevels: [
        { id: 'sl_4', itemId: 'itm_2', locationId: 'loc_a', qty: 60, location: { id: 'loc_a', name: 'Zone A', zone: 'A' } },
        { id: 'sl_5', itemId: 'itm_2', locationId: 'loc_c', qty: 36, location: { id: 'loc_c', name: 'Zone C', zone: 'C' } },
      ],
    },
    {
      id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll', reorderAt: 12, totalQty: 7,
      description: 'Polypropylene strapping, 1000m per roll.',
      stockLevels: [
        { id: 'sl_6', itemId: 'itm_7', locationId: 'loc_b', qty: 7, location: { id: 'loc_b', name: 'Zone B', zone: 'B' } },
      ],
    },
  ]);

  /** Backend-owned data. Wired to GET /api/movements?itemId= by the service layer. */
  readonly movements = signal<Movement[]>([
    { id: 'mv_1', type: 'OUT', itemId: 'itm_1', qty: 6, fromLocId: 'loc_a', toLocId: null, userId: 'u_2', user: { email: 'clerk@demo' }, createdAt: '2026-09-03T14:22:00Z', note: 'Racking rebuild — bay 4', fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: null },
    { id: 'mv_2', type: 'TRANSFER', itemId: 'itm_1', qty: 6, fromLocId: 'loc_a', toLocId: 'loc_b', userId: 'u_1', user: { email: 'manager@demo' }, createdAt: '2026-09-02T09:05:00Z', note: 'Rebalance to Zone B', fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: { id: 'loc_b', name: 'Zone B', zone: 'B' } },
    { id: 'mv_3', type: 'IN', itemId: 'itm_1', qty: 30, fromLocId: null, toLocId: 'loc_a', userId: 'u_2', user: { email: 'clerk@demo' }, createdAt: '2026-08-28T11:40:00Z', note: 'PO-4821 receipt', fromLoc: null, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' } },
  ]);

  readonly loading = signal(false);
  readonly deleteError = signal<string | null>(null);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly itemId = computed(() => this.params().get('id') ?? '');

  readonly item = computed<Item | null>(() => this.items().find((i) => i.id === this.itemId()) ?? null);
  readonly stockLevels = computed<StockLevel[]>(() => this.item()?.stockLevels ?? []);
  readonly itemMovements = computed(() => this.movements().filter((m) => m.itemId === this.item()?.id));

  readonly isLow = computed(() => {
    const item = this.item();
    return item ? item.totalQty <= item.reorderAt : false;
  });
  readonly shortfall = computed(() => {
    const item = this.item();
    return item ? Math.max(0, item.reorderAt - item.totalQty) : 0;
  });

  /** Deletes are refused server-side (400) while stock or history exists. */
  attemptDelete(): void {
    this.deleteError.set(
      'Cannot delete this item: it still has stock on hand and recorded movements. Issue the remaining stock first — the audit trail is never removed.',
    );
  }

  dismissDeleteError(): void {
    this.deleteError.set(null);
  }
}
