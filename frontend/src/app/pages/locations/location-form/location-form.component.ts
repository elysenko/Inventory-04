import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Location } from '../../../core/models';

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

  /** Backend-owned data. Wired to GET /api/locations by the service layer. */
  readonly locations = signal<Location[]>([
    { id: 'loc_a', name: 'Zone A', zone: 'A' },
    { id: 'loc_b', name: 'Zone B', zone: 'B' },
    { id: 'loc_c', name: 'Zone C', zone: 'C' },
  ]);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  readonly editingId = computed(() => this.params().get('id'));
  readonly isEdit = computed(() => this.editingId() !== null);
  readonly heading = computed(() => (this.isEdit() ? 'Edit location' : 'New location'));

  readonly name = signal('');
  readonly zone = signal('');
  readonly nameError = signal<string | null>(null);
  private hydratedFor: string | null = null;

  constructor() {
    const id = this.editingId();
    if (id && this.hydratedFor !== id) {
      const location = this.locations().find((l) => l.id === id);
      if (location) {
        this.hydratedFor = id;
        this.name.set(location.name);
        this.zone.set(location.zone);
      }
    }
  }

  onSubmit(): void {
    this.nameError.set(null);
    if (!this.name().trim()) {
      this.nameError.set('A location needs a name.');
      return;
    }
    const clash = this.locations().find(
      (l) => l.name.toLowerCase() === this.name().trim().toLowerCase() && l.id !== this.editingId(),
    );
    if (clash) {
      this.nameError.set('A location with that name already exists');
      return;
    }
    void this.router.navigate(['/locations']);
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
