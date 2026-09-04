import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ItemsApi } from '../../../core/items-api.service';
import { MovementsApi } from '../../../core/movements-api.service';
import type { Item, Movement, StockLevel } from '../../../core/models';

/** How many audit rows the "Recent movements" panel shows before deferring to the full log. */
const RECENT_MOVEMENTS = 8;

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
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly movementsApi = inject(MovementsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  /** `GET /api/items/:id` — carries the per-location `stockLevels` breakdown. */
  readonly item = signal<Item | null>(null);

  /** `GET /api/movements?itemId=` — manager-only on the API, so a clerk simply sees
   *  the empty state rather than a request that would 403. */
  readonly movements = signal<Movement[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);
  readonly deleting = signal(false);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly itemId = computed(() => this.params().get('id') ?? '');

  readonly stockLevels = computed<StockLevel[]>(() => this.item()?.stockLevels ?? []);
  readonly itemMovements = computed(() => this.movements());

  readonly isLow = computed(() => {
    const item = this.item();
    return item ? item.totalQty <= item.reorderAt : false;
  });
  readonly shortfall = computed(() => {
    const item = this.item();
    return item ? Math.max(0, item.reorderAt - item.totalQty) : 0;
  });

  constructor() {
    // Re-fetches whenever the :id segment changes, so navigating between items
    // inside the SPA reloads the detail instead of showing the previous one.
    effect(() => {
      const id = this.itemId();
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.deleteError.set(null);

    this.itemsApi
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.item.set(item);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.item.set(null);
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });

    if (!this.auth.isManager()) {
      this.movements.set([]);
      return;
    }
    this.movementsApi
      .list({ itemId: id, pageSize: RECENT_MOVEMENTS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.movements.set(page.data),
        // The history panel is supplementary: a failure must not hide the item itself.
        error: () => this.movements.set([]),
      });
  }

  /** The API refuses (400) while stock or movement history exists, so the audit
   *  trail can never be orphaned; that refusal is what this surfaces. */
  attemptDelete(): void {
    const item = this.item();
    if (!item || this.deleting()) return;

    this.deleting.set(true);
    this.deleteError.set(null);
    this.itemsApi
      .remove(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          void this.router.navigate(['/items']);
        },
        error: (err: unknown) => {
          this.deleting.set(false);
          this.deleteError.set(apiErrorMessage(err));
        },
      });
  }

  dismissDeleteError(): void {
    this.deleteError.set(null);
  }
}
