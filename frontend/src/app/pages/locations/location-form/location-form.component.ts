import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { LocationsApi, type LocationPayload } from '../../../core/locations-api.service';

/** Shared create/edit form behind /locations/new and /locations/:id/edit. */
@Component({
  selector: 'app-location-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locationsApi = inject(LocationsApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly editingId = computed(() => this.params().get('id'));
  readonly isEdit = computed(() => this.editingId() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Edit location' : 'New location'));

  readonly name = signal('');
  readonly zone = signal('');
  readonly nameError = signal<string | null>(null);
  readonly saving = signal(false);
  private hydratedFor: string | null = null;

  constructor() {
    effect(() => {
      const id = this.editingId();
      if (id && this.hydratedFor !== id) this.hydrate(id);
    });
  }

  /** Renaming touches no stock level and reassigns no movement history — the
   *  server updates the row in place. */
  private hydrate(id: string): void {
    this.hydratedFor = id;
    this.locationsApi
      .get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (location) => {
          this.name.set(location.name);
          this.zone.set(location.zone);
        },
        error: (err: unknown) => this.nameError.set(apiErrorMessage(err)),
      });
  }

  onSubmit(): void {
    if (this.saving()) return;
    this.nameError.set(null);

    if (!this.name().trim()) {
      this.nameError.set('A location needs a name.');
      return;
    }
    if (!this.zone().trim()) {
      this.nameError.set('A location needs a zone.');
      return;
    }

    const payload: LocationPayload = { name: this.name().trim(), zone: this.zone().trim() };
    const id = this.editingId();
    const request = id ? this.locationsApi.update(id, payload) : this.locationsApi.create(payload);

    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/locations']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // Duplicate names come back as 400 "A location with that name already exists".
        this.nameError.set(apiErrorMessage(err));
      },
    });
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
