import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { AuthService } from '../../../core/auth.service';
import { ItemsApi } from '../../../core/items-api.service';
import { LocationsApi } from '../../../core/locations-api.service';
import { MovementsApi, type CreateMovementPayload } from '../../../core/movements-api.service';
import type { Item, Location, MovementType, StockLevel } from '../../../core/models';

@Component({
  selector: 'app-movement-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly movementsApi = inject(MovementsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly auth = inject(AuthService);

  /** `GET /api/items` — populates the item select. */
  readonly items = signal<Item[]>([]);

  /** `GET /api/locations` — clerk-readable, which is why this form works for both roles. */
  readonly locations = signal<Location[]>([]);

  /** `GET /api/items/:id` for the selected item: its per-location balances back the
   *  availability hint and the "on hand" panel. Refreshed after every movement, so
   *  the numbers on screen are the server's, not an optimistic guess. */
  private readonly detail = signal<Item | null>(null);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  /** Type and item live in the URL so every variant of this form is deep-linkable. */
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  readonly type = computed<MovementType>(() => {
    const raw = this.params().get('type');
    return raw === 'OUT' || raw === 'TRANSFER' ? raw : 'IN';
  });
  readonly itemId = computed(() => this.params().get('itemId') ?? this.items()[0]?.id ?? '');

  /** Location overrides. Until the user picks one, the form defaults to the
   *  location that actually holds the selected item, so an OUT never opens on
   *  a zone with nothing on hand. */
  private readonly fromOverride = signal<string | null>(null);
  private readonly toOverride = signal<string | null>(null);
  readonly qty = signal(10);
  readonly note = signal('');

  readonly stockLevels = computed<StockLevel[]>(() => this.detail()?.stockLevels ?? []);

  readonly selectedItem = computed<Item | null>(() => {
    const id = this.itemId();
    const detail = this.detail();
    if (detail && detail.id === id) return detail;
    return this.items().find((i) => i.id === id) ?? null;
  });

  readonly needsFrom = computed(() => this.type() === 'OUT' || this.type() === 'TRANSFER');
  readonly needsTo = computed(() => this.type() === 'IN' || this.type() === 'TRANSFER');

  /** Where the item is actually stocked, richest location first. */
  private readonly defaultFrom = computed(() => {
    const stocked = this.stockLevels()
      .filter((s) => s.qty > 0)
      .sort((a, b) => b.qty - a.qty);
    return stocked[0]?.locationId ?? this.locations()[0]?.id ?? '';
  });

  readonly fromLocId = computed(() => this.fromOverride() ?? this.defaultFrom());
  readonly toLocId = computed(
    () => this.toOverride() ?? this.locations().find((l) => l.id !== this.fromLocId())?.id ?? '',
  );

  readonly available = computed(() => this.balanceAt(this.fromLocId()));

  readonly itemBreakdown = computed(() =>
    this.locations().map((location) => ({ location, qty: this.balanceAt(location.id) })),
  );

  constructor() {
    this.loadCatalog();

    // Reload the balances whenever the selected item changes.
    effect(() => {
      const id = this.itemId();
      if (id) this.loadDetail(id);
    });
  }

  private loadCatalog(): void {
    this.loading.set(true);
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

    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => this.locations.set(locations),
        error: (err: unknown) => this.error.set(apiErrorMessage(err)),
      });
  }

  private loadDetail(itemId: string): void {
    this.itemsApi
      .get(itemId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => this.detail.set(item),
        // A missing breakdown only costs the hint; the server still enforces availability.
        error: () => this.detail.set(null),
      });
  }

  private balanceAt(locationId: string): number {
    return this.stockLevels().find((s) => s.locationId === locationId)?.qty ?? 0;
  }

  setType(type: MovementType): void {
    this.error.set(null);
    this.success.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  setFrom(locationId: string): void {
    this.fromOverride.set(locationId);
    this.error.set(null);
  }

  setTo(locationId: string): void {
    this.toOverride.set(locationId);
    this.error.set(null);
  }

  setItem(itemId: string): void {
    this.error.set(null);
    // A new item lives in different zones — fall back to the computed defaults.
    this.fromOverride.set(null);
    this.toOverride.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { itemId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /**
   * Mirrors the server-side DTO rules so obvious mistakes are caught without a
   * round-trip — but the authority is the API, which applies the balance change
   * and the audit row in one transaction and refuses an issue that would drive a
   * balance negative.
   */
  onSubmit(): void {
    if (this.submitting()) return;
    this.error.set(null);
    this.success.set(null);

    const item = this.selectedItem();
    if (!item) {
      this.error.set('Choose an item to move.');
      return;
    }
    if (!Number.isInteger(this.qty()) || this.qty() < 1) {
      this.error.set('Quantity must be a whole number of at least 1.');
      return;
    }
    if (this.needsFrom() && !this.fromLocId()) {
      this.error.set('Choose the location the stock is leaving.');
      return;
    }
    if (this.needsTo() && !this.toLocId()) {
      this.error.set('Choose the location the stock is arriving at.');
      return;
    }
    if (this.type() === 'TRANSFER' && this.fromLocId() === this.toLocId()) {
      this.error.set('A transfer must move stock between two different locations.');
      return;
    }

    const payload: CreateMovementPayload = {
      type: this.type(),
      itemId: item.id,
      qty: this.qty(),
      // The API rejects a source on an IN and a destination on an OUT, so only
      // the endpoints this movement type owns are sent.
      fromLocId: this.needsFrom() ? this.fromLocId() : undefined,
      toLocId: this.needsTo() ? this.toLocId() : undefined,
      note: this.note().trim() || undefined,
    };

    const availableBefore = this.available();
    this.submitting.set(true);
    this.movementsApi
      .create(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(this.describeResult(item.unit, item.sku, availableBefore));
          this.note.set('');
          // Re-read the balances the server now holds.
          this.loadDetail(item.id);
          this.refreshItems();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          // e.g. "Insufficient stock" — the transaction rolled back, so the
          // balance is unchanged and the log recorded nothing.
          this.error.set(apiErrorMessage(err));
          this.loadDetail(item.id);
        },
      });
  }

  private refreshItems(): void {
    this.itemsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (items) => this.items.set(items), error: () => undefined });
  }

  private describeResult(unit: string, sku: string, availableBefore: number): string {
    const qty = this.qty();
    switch (this.type()) {
      case 'IN':
        return `Received ${qty} ${unit} of ${sku} into ${this.locationName(this.toLocId())}. The audit log records you as the actor.`;
      case 'OUT':
        return `Issued ${qty} ${unit} of ${sku} from ${this.locationName(this.fromLocId())}. Balance now ${availableBefore - qty}.`;
      default:
        return `Transferred ${qty} ${unit} of ${sku} from ${this.locationName(this.fromLocId())} to ${this.locationName(this.toLocId())}. Total on hand is unchanged.`;
    }
  }

  locationName(id: string): string {
    return this.locations().find((l) => l.id === id)?.name ?? '—';
  }
}
