import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Location } from '../../../core/models';

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
  /** Backend-owned data. Wired to GET /api/locations by the service layer. */
  readonly locations = signal<LocationRow[]>([
    { id: 'loc_a', name: 'Zone A', zone: 'A', itemCount: 6, totalQty: 214 },
    { id: 'loc_b', name: 'Zone B', zone: 'B', itemCount: 4, totalQty: 88 },
    { id: 'loc_c', name: 'Zone C', zone: 'C', itemCount: 3, totalQty: 96 },
  ]);

  readonly loading = signal(false);
  readonly deleteError = signal<string | null>(null);

  readonly totalQty = computed(() => this.locations().reduce((sum, l) => sum + l.totalQty, 0));

  /** Deletes are refused server-side (400) while stock or movements reference the location. */
  attemptDelete(location: LocationRow): void {
    this.deleteError.set(
      `Cannot delete ${location.name}: ${location.itemCount} items still hold stock there and movements reference it. Move the stock out first.`,
    );
  }

  dismissError(): void {
    this.deleteError.set(null);
  }
}
