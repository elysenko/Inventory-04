import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ItemsApi } from '../../../core/items-api.service';
import { LocationsApi } from '../../../core/locations-api.service';
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
  private readonly itemsApi = inject(ItemsApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  /** The whole catalog from `GET /api/items`, with `totalQty` summed server-side
   *  across every location. Held unfiltered so the summary tiles describe the
   *  catalog rather than the current search. */
  readonly items = signal<Item[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Filter state is read from the URL so a filtered list is shareable. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly query = computed(() => this.params().get('q') ?? '');
  readonly lowStockOnly = computed(() => this.params().get('lowStock') === 'true');
  readonly deniedRole = computed(() => this.params().get('denied'));

  readonly locationCount = signal(0);

  readonly lowStockCount = computed(() => this.items().filter((i) => i.totalQty <= i.reorderAt).length);
  readonly totalOnHand = computed(() => this.items().reduce((sum, i) => sum + i.totalQty, 0));

  /** Filtering stays client-side: the catalog is already loaded, so typing filters
   *  without a round-trip and the tiles above keep counting the full catalog. */
  readonly visibleItems = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.lowStockOnly() && item.totalQty > item.reorderAt) return false;
      if (!q) return true;
      return `${item.sku} ${item.name}`.toLowerCase().includes(q);
    });
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.itemsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });

    // Only feeds the "across N locations" hint — a failure here must not blank the catalog.
    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => this.locationCount.set(locations.length),
        error: () => this.locationCount.set(0),
      });
  }

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
