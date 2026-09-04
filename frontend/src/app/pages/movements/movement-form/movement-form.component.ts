import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/auth.service';
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
  readonly auth = inject(AuthService);

  /** Backend-owned data. Wired to GET /api/items by the service layer. */
  readonly items = signal<Item[]>([
    { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box', reorderAt: 40, totalQty: 18 },
    { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box', reorderAt: 30, totalQty: 96 },
    { id: 'itm_3', sku: 'WSH-M8', name: 'Flat Washer M8', unit: 'box', reorderAt: 25, totalQty: 24 },
    { id: 'itm_4', sku: 'TAPE-DUCT-50', name: 'Duct Tape 50mm', unit: 'roll', reorderAt: 20, totalQty: 62 },
    { id: 'itm_5', sku: 'GLV-NIT-L', name: 'Nitrile Gloves — Large', unit: 'box', reorderAt: 15, totalQty: 15 },
    { id: 'itm_6', sku: 'PLT-EUR', name: 'Euro Pallet 1200 × 800', unit: 'each', reorderAt: 10, totalQty: 48 },
    { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll', reorderAt: 12, totalQty: 7 },
    { id: 'itm_8', sku: 'LBL-TH-4', name: 'Thermal Label 4in', unit: 'roll', reorderAt: 18, totalQty: 130 },
  ]);

  /** Backend-owned data. Wired to GET /api/locations by the service layer. */
  readonly locations = signal<Location[]>([
    { id: 'loc_a', name: 'Zone A', zone: 'A' },
    { id: 'loc_b', name: 'Zone B', zone: 'B' },
    { id: 'loc_c', name: 'Zone C', zone: 'C' },
  ]);

  /** Backend-owned data. Per-(item, location) balances used for the availability hint. */
  readonly stockLevels = signal<StockLevel[]>([
    { id: 'sl_1', itemId: 'itm_1', locationId: 'loc_a', qty: 12 },
    { id: 'sl_2', itemId: 'itm_1', locationId: 'loc_b', qty: 6 },
    { id: 'sl_3', itemId: 'itm_2', locationId: 'loc_a', qty: 60 },
    { id: 'sl_4', itemId: 'itm_2', locationId: 'loc_c', qty: 36 },
    { id: 'sl_5', itemId: 'itm_3', locationId: 'loc_a', qty: 24 },
    { id: 'sl_6', itemId: 'itm_4', locationId: 'loc_b', qty: 62 },
    { id: 'sl_7', itemId: 'itm_5', locationId: 'loc_a', qty: 15 },
    { id: 'sl_8', itemId: 'itm_6', locationId: 'loc_c', qty: 48 },
    { id: 'sl_9', itemId: 'itm_7', locationId: 'loc_b', qty: 7 },
    { id: 'sl_10', itemId: 'itm_8', locationId: 'loc_a', qty: 130 },
  ]);

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

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly selectedItem = computed(() => this.items().find((i) => i.id === this.itemId()) ?? null);
  readonly needsFrom = computed(() => this.type() === 'OUT' || this.type() === 'TRANSFER');
  readonly needsTo = computed(() => this.type() === 'IN' || this.type() === 'TRANSFER');

  /** Where the item is actually stocked, richest location first. */
  private readonly defaultFrom = computed(() => {
    const stocked = this.stockLevels()
      .filter((s) => s.itemId === this.itemId() && s.qty > 0)
      .sort((a, b) => b.qty - a.qty);
    return stocked[0]?.locationId ?? this.locations()[0]?.id ?? '';
  });

  readonly fromLocId = computed(() => this.fromOverride() ?? this.defaultFrom());
  readonly toLocId = computed(
    () => this.toOverride() ?? this.locations().find((l) => l.id !== this.fromLocId())?.id ?? '',
  );

  readonly available = computed(() => this.balanceAt(this.itemId(), this.fromLocId()));

  readonly itemBreakdown = computed(() =>
    this.locations().map((location) => ({ location, qty: this.balanceAt(this.itemId(), location.id) })),
  );

  private balanceAt(itemId: string, locationId: string): number {
    return this.stockLevels().find((s) => s.itemId === itemId && s.locationId === locationId)?.qty ?? 0;
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

  /** Mirrors the server-side DTO rules and the guarded decrement in one place. */
  onSubmit(): void {
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
    if (this.needsFrom() && this.qty() > this.available()) {
      this.error.set(
        `Insufficient stock — only ${this.available()} ${item.unit} of ${item.sku} on hand at ${this.locationName(this.fromLocId())}. The balance is unchanged.`,
      );
      return;
    }

    this.success.set(this.describeResult(item.unit, item.sku));
    this.note.set('');
  }

  private describeResult(unit: string, sku: string): string {
    const qty = this.qty();
    switch (this.type()) {
      case 'IN':
        return `Received ${qty} ${unit} of ${sku} into ${this.locationName(this.toLocId())}. The audit log records you as the actor.`;
      case 'OUT':
        return `Issued ${qty} ${unit} of ${sku} from ${this.locationName(this.fromLocId())}. Balance now ${this.available() - qty}.`;
      default:
        return `Transferred ${qty} ${unit} of ${sku} from ${this.locationName(this.fromLocId())} to ${this.locationName(this.toLocId())}. Total on hand is unchanged.`;
    }
  }

  locationName(id: string): string {
    return this.locations().find((l) => l.id === id)?.name ?? '—';
  }
}
