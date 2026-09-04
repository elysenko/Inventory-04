import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Item } from '../../../core/models';

/** Shared create/edit form behind /items/new and /items/:id/edit. */
@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Backend-owned data. Wired to GET /api/items by the service layer. */
  readonly items = signal<Item[]>([
    { id: 'itm_1', sku: 'BLT-M8-50', name: 'Hex Bolt M8 × 50mm', unit: 'box', reorderAt: 40, totalQty: 18, description: 'Zinc-plated, 100 per box' },
    { id: 'itm_2', sku: 'NUT-M8', name: 'Hex Nut M8', unit: 'box', reorderAt: 30, totalQty: 96, description: 'Zinc-plated, 200 per box' },
    { id: 'itm_7', sku: 'STRP-16', name: 'Strapping Band 16mm', unit: 'roll', reorderAt: 12, totalQty: 7, description: 'Polypropylene, 1000m' },
  ]);

  readonly units = signal<string[]>(['each', 'box', 'roll', 'pallet', 'metre', 'kilogram']);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly editingId = computed(() => this.params().get('id'));
  readonly isEdit = computed(() => this.editingId() !== null);

  readonly sku = signal('');
  readonly name = signal('');
  readonly description = signal('');
  readonly unit = signal('box');
  readonly reorderAt = signal(10);

  readonly skuError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly saved = signal(false);
  private hydratedFor: string | null = null;

  readonly heading = computed(() => (this.isEdit() ? 'Edit item' : 'New item'));

  constructor() {
    this.hydrate();
  }

  /** Populates the form from the item being edited, once per :id. */
  private hydrate(): void {
    const id = this.editingId();
    if (!id || this.hydratedFor === id) return;
    const item = this.items().find((i) => i.id === id);
    if (!item) return;
    this.hydratedFor = id;
    this.sku.set(item.sku);
    this.name.set(item.name);
    this.description.set(item.description ?? '');
    this.unit.set(item.unit);
    this.reorderAt.set(item.reorderAt);
  }

  onSubmit(): void {
    this.skuError.set(null);
    this.formError.set(null);
    this.saved.set(false);

    if (!this.sku().trim() || !this.name().trim()) {
      this.formError.set('SKU and name are both required.');
      return;
    }
    if (this.reorderAt() < 0) {
      this.formError.set('The reorder point cannot be negative.');
      return;
    }

    // Mirrors the server's 400 on a duplicate sku (Prisma P2002 on Item.sku).
    const clash = this.items().find(
      (i) => i.sku.toLowerCase() === this.sku().trim().toLowerCase() && i.id !== this.editingId(),
    );
    if (clash) {
      this.skuError.set('SKU already exists');
      return;
    }

    this.saved.set(true);
    void this.router.navigate(['/items']);
  }

  cancel(): void {
    void this.router.navigate(this.isEdit() ? ['/items', this.editingId()] : ['/items']);
  }
}
