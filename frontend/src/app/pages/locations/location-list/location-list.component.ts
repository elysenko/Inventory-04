import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api.service';
import { ItemsApi } from '../../../core/items-api.service';
import { LocationsApi } from '../../../core/locations-api.service';
import type { Item, Location } from '../../../core/models';

interface LocationRow extends Location {
  itemCount: number;
  totalQty: number;
}

@Component({
  selector: 'app-location-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent {
  private readonly locationsApi = inject(LocationsApi);
  private readonly itemsApi = inject(ItemsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly locations = signal<LocationRow[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  readonly totalQty = computed(() => this.locations().reduce((sum, l) => sum + l.totalQty, 0));

  constructor() {
    this.load();
  }

  /**
   * The API exposes stock levels per item (`GET /api/items/:id`) rather than per
   * location, so the "items held / units on hand" columns are aggregated here from
   * each item's breakdown. The catalog is small and this screen is manager-only, so
   * the fan-out is bounded; it is issued concurrently rather than in sequence.
   */
  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({ locations: this.locationsApi.list(), items: this.itemsApi.list() })
      .pipe(
        switchMap(({ locations, items }) =>
          items.length === 0
            ? of({ locations, details: [] as Item[] })
            : forkJoin(items.map((item) => this.itemsApi.get(item.id))).pipe(
                map((details) => ({ locations, details })),
              ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ locations, details }) => {
          this.locations.set(locations.map((location) => this.summarise(location, details)));
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  private summarise(location: Location, items: Item[]): LocationRow {
    let itemCount = 0;
    let totalQty = 0;
    for (const item of items) {
      const level = item.stockLevels?.find((s) => s.locationId === location.id);
      if (!level || level.qty <= 0) continue;
      itemCount += 1;
      totalQty += level.qty;
    }
    return { ...location, itemCount, totalQty };
  }

  /** The API refuses (400) while stock or movement history references the location. */
  attemptDelete(location: LocationRow): void {
    this.deleteError.set(null);
    this.locationsApi
      .remove(location.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (err: unknown) => this.deleteError.set(apiErrorMessage(err)),
      });
  }

  dismissError(): void {
    this.deleteError.set(null);
  }
}
