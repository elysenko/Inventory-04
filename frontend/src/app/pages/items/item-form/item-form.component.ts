import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage, toApiError } from '../../../core/api.service';
import { ItemsApi, type ItemPayload } from '../../../core/items-api.service';

/** The server reports a clashing SKU as a 400 carrying exactly this sentence. */
const DUPLICATE_SKU = 'SKU already exists';

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
  private readonly itemsApi = inject(ItemsApi);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly saving = signal(false);
  readonly loading = signal(false);
  private hydratedFor: string | null = null;

  readonly heading = computed(() => (this.isEdit() ? 'Edit item' : 'New item'));

  constructor() {
    effect(() => {
      const id = this.editingId();
      if (id && this.hydratedFor !== id) this.hydrate(id);
    });
  }

  /** Populates the form from `GET /api/items/:id`, once per :id. */
  private hydrate(id: string): void {
    this.hydratedFor = id;
    this.loading.set(true);
    this.itemsApi
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.sku.set(item.sku);
          this.name.set(item.name);
          this.description.set(item.description ?? '');
          this.unit.set(item.unit);
          this.reorderAt.set(item.reorderAt);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.formError.set(apiErrorMessage(err));
        },
      });
  }

  onSubmit(): void {
    if (this.saving()) return;
    this.skuError.set(null);
    this.formError.set(null);

    if (!this.sku().trim() || !this.name().trim()) {
      this.formError.set('SKU and name are both required.');
      return;
    }
    if (this.reorderAt() < 0) {
      this.formError.set('The reorder point cannot be negative.');
      return;
    }

    const payload: ItemPayload = {
      sku: this.sku().trim(),
      name: this.name().trim(),
      description: this.description().trim(),
      unit: this.unit(),
      reorderAt: Number(this.reorderAt()),
    };

    const id = this.editingId();
    const request = id ? this.itemsApi.update(id, payload) : this.itemsApi.create(payload);

    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/items']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const { message } = toApiError(err);
        // A duplicate SKU belongs on the field; everything else is a form-level problem.
        if (message.toLowerCase().includes('sku already exists')) this.skuError.set(DUPLICATE_SKU);
        else this.formError.set(message);
      },
    });
  }

  cancel(): void {
    void this.router.navigate(this.isEdit() ? ['/items', this.editingId()] : ['/items']);
  }
}
