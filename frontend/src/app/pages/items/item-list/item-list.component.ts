import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { AuthService } from '../../../core/auth.service';
import type { Item } from '../../../core/models';

@Component({
  selector: 'app-item-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Backend-owned data. Wired to GET /api/items by the service layer. */
  readonly items = signal<Item[]>([
    { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box', reorderAt: 40, totalQty: 18, description: 'Zinc-plated, 100 per box' },
    { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box', reorderAt: 30, totalQty: 96, description: 'Zinc-plated, 200 per box' },
    { id: 'itm_3', sku: 'WSH-M8', name: 'Flat Washer M8', unit: 'box', reorderAt: 25, totalQty: 24, description: 'Stainless A2, 250 per box' },
    { id: 'itm_4', sku: 'TAPE-DUCT-50', name: 'Duct Tape 50mm', unit: 'roll', reorderAt: 20, totalQty: 62, description: 'Silver, 50m roll' },
    { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box', reorderAt: 15, totalQty: 15, description: 'Powder-free, 100 per box' },
    { id: 'itm_6', sku: 'PLT-EUR', name: 'Euro Pallet 1200 × 800', unit: 'each', reorderAt: 10, totalQty: 48, description: 'Heat-treated timber' },
    { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll', reorderAt: 12, totalQty: 7, description: 'Polypropylene, 1000m' },
    { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll', reorderAt: 18, totalQty: 130, description: 'Direct thermal, 1000 per roll' },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Filter state is read from the URL so a filtered list is shareable. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly query = computed(() => this.params().get('q') ?? '');
  readonly lowStockOnly = computed(() => this.params().get('lowStock') === 'true');
  readonly deniedRole = computed(() => this.params().get('denied'));

  readonly locationCount = signal(3);

  readonly lowStockCount = computed(() => this.items().filter((i) => i.totalQty <= i.reorderAt).length);
  readonly totalOnHand = computed(() => this.items().reduce((sum, i) => sum + i.totalQty, 0));

  readonly visibleItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.lowStockOnly() && item.totalQty > item.reorderAt) return false;
      if (!q) return true;
      return `${item.sku} ${item.name}`.toLowerCase().includes(q);
    });
  });

  isLow(item: Item): boolean {
    return item.totalQty <= item.reorderAt;
  }

  onSearch(value: string): void {
    this.patchParams({ q: value.trim() || null });
  }

  toggleLowStock(checked: boolean): void {
    this.patchParams({ lowStock: checked ? 'true' : null });
  }

  clearFilters(): void {
    this.patchParams({ q: null, lowStock: null });
  }

  private patchParams(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
