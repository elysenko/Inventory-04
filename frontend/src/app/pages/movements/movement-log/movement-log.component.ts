import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { ItemsApi } from '../../../core/items-api.service';
import { MovementsApi } from '../../../core/movements-api.service';
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
  private readonly itemsApi = inject(ItemsApi);
  private readonly movementsApi = inject(MovementsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = PAGE_SIZE;
  readonly movementTypes = MOVEMENT_TYPES;

  /** `GET /api/items` — only feeds the item filter select. */
  readonly items = signal<Item[]>([]);

  /** One page of `GET /api/movements`, already filtered, ordered and paginated by
   *  the server (newest first, with the actor, item and both endpoints included). */
  readonly rows = signal<Movement[]>([]);
  readonly total = signal(0);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /** Every filter is restored from the URL, so a filtered log is a shareable link. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly itemFilter = computed(() => this.params().get('itemId') ?? '');
  readonly typeFilter = computed(() => this.params().get('type') ?? '');
  readonly fromFilter = computed(() => this.params().get('from') ?? '');
  readonly toFilter = computed(() => this.params().get('to') ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly hasFilters = computed(() => !!(this.itemFilter() || this.typeFilter() || this.fromFilter() || this.toFilter()));

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly rangeStart = computed(() => (this.total() === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly rangeEnd = computed(() => Math.min(this.rangeStart() + this.rows().length - 1, this.total()));

  constructor() {
    this.loadItems();

    // Any change to the URL filters or page re-queries the server; nothing is
    // filtered client-side, so the counts always describe the whole log.
    effect(() => {
      const query = {
        itemId: this.itemFilter(),
        type: this.typeFilter() as MovementType | '',
        from: this.fromFilter(),
        to: this.toFilter(),
        page: this.page(),
        pageSize: PAGE_SIZE,
      };
      this.load(query);
    });
  }

  private load(query: {
    itemId: string;
    type: MovementType | '';
    from: string;
    to: string;
    page: number;
    pageSize: number;
  }): void {
    this.loading.set(true);
    this.error.set(null);
    this.movementsApi
      .list(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rows.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.rows.set([]);
          this.total.set(0);
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  private loadItems(): void {
    this.itemsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (items) => this.items.set(items), error: () => this.items.set([]) });
  }

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
