import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Item, Movement, MovementType } from '../../../core/models';
import { MOVEMENT_TYPES } from '../../../core/models';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly pageSize = PAGE_SIZE;
  readonly movementTypes = MOVEMENT_TYPES;

  /** Backend-owned data. Wired to GET /api/items by the service layer. */
  readonly items = signal<Item[]>([
    { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box', reorderAt: 40, totalQty: 18 },
    { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box', reorderAt: 30, totalQty: 96 },
    { id: 'itm_4', sku: 'TAPE-DUCT-50', name: 'Duct Tape 50mm', unit: 'roll', reorderAt: 20, totalQty: 62 },
    { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box', reorderAt: 15, totalQty: 15 },
    { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll', reorderAt: 12, totalQty: 7 },
    { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll', reorderAt: 18, totalQty: 130 },
  ]);

  /** Backend-owned data. Wired to GET /api/movements by the service layer. */
  readonly movements = signal<Movement[]>([
    { id: 'mv_01', type: 'OUT', itemId: 'itm_1', item: { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box' }, qty: 6, fromLocId: 'loc_a', toLocId: null, fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: null, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'Racking rebuild — bay 4', createdAt: '2026-09-03T14:22:00Z' },
    { id: 'mv_02', type: 'IN', itemId: 'itm_8', item: { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll' }, qty: 40, fromLocId: null, toLocId: 'loc_a', fromLoc: null, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'PO-4907 receipt', createdAt: '2026-09-03T10:07:00Z' },
    { id: 'mv_03', type: 'TRANSFER', itemId: 'itm_2', item: { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box' }, qty: 12, fromLocId: 'loc_a', toLocId: 'loc_c', fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: { id: 'loc_c', name: 'Zone C', zone: 'C' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'Consolidate slow movers', createdAt: '2026-09-02T16:45:00Z' },
    { id: 'mv_04', type: 'TRANSFER', itemId: 'itm_1', item: { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box' }, qty: 6, fromLocId: 'loc_a', toLocId: 'loc_b', fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: { id: 'loc_b', name: 'Zone B', zone: 'B' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'Rebalance to Zone B', createdAt: '2026-09-02T09:05:00Z' },
    { id: 'mv_05', type: 'OUT', itemId: 'itm_5', item: { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box' }, qty: 5, fromLocId: 'loc_a', toLocId: null, fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: null, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'Line 2 resupply', createdAt: '2026-09-01T13:18:00Z' },
    { id: 'mv_06', type: 'IN', itemId: 'itm_4', item: { id: 'itm_4', sku: 'TAPE-DUCT-50', name: 'Duct Tape 50mm', unit: 'roll' }, qty: 24, fromLocId: null, toLocId: 'loc_b', fromLoc: null, toLoc: { id: 'loc_b', name: 'Zone B', zone: 'B' }, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'PO-4881 receipt', createdAt: '2026-09-01T08:52:00Z' },
    { id: 'mv_07', type: 'OUT', itemId: 'itm_7', item: { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll' }, qty: 4, fromLocId: 'loc_b', toLocId: null, fromLoc: { id: 'loc_b', name: 'Zone B', zone: 'B' }, toLoc: null, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'Outbound wrapping', createdAt: '2026-08-31T15:30:00Z' },
    { id: 'mv_08', type: 'IN', itemId: 'itm_2', item: { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box' }, qty: 48, fromLocId: null, toLocId: 'loc_a', fromLoc: null, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'PO-4863 receipt', createdAt: '2026-08-30T11:12:00Z' },
    { id: 'mv_09', type: 'IN', itemId: 'itm_1', item: { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box' }, qty: 30, fromLocId: null, toLocId: 'loc_a', fromLoc: null, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'PO-4821 receipt', createdAt: '2026-08-28T11:40:00Z' },
    { id: 'mv_10', type: 'OUT', itemId: 'itm_8', item: { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll' }, qty: 10, fromLocId: 'loc_a', toLocId: null, fromLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, toLoc: null, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'Despatch desk', createdAt: '2026-08-27T09:24:00Z' },
    { id: 'mv_11', type: 'TRANSFER', itemId: 'itm_8', item: { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll' }, qty: 20, fromLocId: 'loc_c', toLocId: 'loc_a', fromLoc: { id: 'loc_c', name: 'Zone C', zone: 'C' }, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'Closer to the printers', createdAt: '2026-08-26T14:02:00Z' },
    { id: 'mv_12', type: 'IN', itemId: 'itm_5', item: { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box' }, qty: 20, fromLocId: null, toLocId: 'loc_a', fromLoc: null, toLoc: { id: 'loc_a', name: 'Zone A', zone: 'A' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'PO-4802 receipt', createdAt: '2026-08-25T10:15:00Z' },
    { id: 'mv_13', type: 'OUT', itemId: 'itm_2', item: { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box' }, qty: 8, fromLocId: 'loc_c', toLocId: null, fromLoc: { id: 'loc_c', name: 'Zone C', zone: 'C' }, toLoc: null, userId: 'u_2', user: { email: 'clerk@demo' }, note: 'Maintenance draw', createdAt: '2026-08-24T16:40:00Z' },
    { id: 'mv_14', type: 'IN', itemId: 'itm_7', item: { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll' }, qty: 11, fromLocId: null, toLocId: 'loc_b', fromLoc: null, toLoc: { id: 'loc_b', name: 'Zone B', zone: 'B' }, userId: 'u_1', user: { email: 'manager@demo' }, note: 'PO-4790 receipt', createdAt: '2026-08-23T08:05:00Z' },
  ]);

  readonly loading = signal(false);

  /** Every filter is restored from the URL, so a filtered log is a shareable link. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly itemFilter = computed(() => this.params().get('itemId') ?? '');
  readonly typeFilter = computed(() => this.params().get('type') ?? '');
  readonly fromFilter = computed(() => this.params().get('from') ?? '');
  readonly toFilter = computed(() => this.params().get('to') ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly hasFilters = computed(() => !!(this.itemFilter() || this.typeFilter() || this.fromFilter() || this.toFilter()));

  readonly filtered = computed(() => {
    const itemId = this.itemFilter();
    const type = this.typeFilter();
    const from = this.fromFilter() ? Date.parse(`${this.fromFilter()}T00:00:00Z`) : null;
    const to = this.toFilter() ? Date.parse(`${this.toFilter()}T23:59:59Z`) : null;

    return this.movements()
      .filter((m) => {
        if (itemId && m.itemId !== itemId) return false;
        if (type && m.type !== type) return false;
        const at = Date.parse(m.createdAt);
        if (from !== null && at < from) return false;
        if (to !== null && at > to) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });

  readonly total = computed(() => this.filtered().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly rows = computed(() => {
    const start = (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE + 1));
  readonly rangeEnd = computed(() => Math.min(this.rangeStart() + PAGE_SIZE - 1, this.total()));

  setFilter(key: 'itemId' | 'type' | 'from' | 'to', value: string): void {
    this.patch({ [key]: value || null, page: null });
  }

  goToPage(page: number): void {
    this.patch({ page: page <= 1 ? null : String(page) });
  }

  clearFilters(): void {
    this.patch({ itemId: null, type: null, from: null, to: null, page: null });
  }

  typeClass(type: MovementType): string {
    return `badge badge--${type.toLowerCase()}`;
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
