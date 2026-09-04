import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../../core/api.service';
import { SettingsApi } from '../../../core/settings-api.service';
import type { ServiceSettings } from '../../../core/models';

/** Server-side sentinel for "this key exists but has not been configured yet". */
const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly settingsApi = inject(SettingsApi);
  private readonly destroyRef = inject(DestroyRef);

  readonly placeholder = PLACEHOLDER;

  /** `GET /api/admin/settings` — the provisioned services and a masked rendering
   *  of each credential. The plaintext never leaves the server, so a saved secret
   *  cannot be read back out through this screen. */
  readonly services = signal<ServiceSettings[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly drafts = signal<Record<string, string>>({});
  readonly savedService = signal<string | null>(null);
  readonly saving = signal<string | null>(null);

  readonly unconfigured = computed(() => this.services().filter((s) => !s.configured));
  readonly unconfiguredNames = computed(() => this.unconfigured().map((s) => s.label).join(', '));

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.settingsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (services) => {
          this.services.set(services);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  draftFor(key: string): string {
    return this.drafts()[key] ?? '';
  }

  setDraft(key: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [key]: value }));
    this.savedService.set(null);
    this.error.set(null);
  }

  /** Writes only the keys the admin actually typed into — an untouched field must
   *  not overwrite a configured credential with an empty string. */
  save(service: ServiceSettings): void {
    if (this.saving()) return;

    const values: Record<string, string> = {};
    for (const setting of service.settings) {
      const draft = this.drafts()[setting.key];
      if (draft !== undefined && draft.trim() !== '') values[setting.key] = draft.trim();
    }
    if (Object.keys(values).length === 0) {
      this.error.set(`Enter at least one ${service.label} value before saving.`);
      return;
    }

    this.saving.set(service.service);
    this.error.set(null);
    this.settingsApi
      .update(values)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(null);
          this.savedService.set(service.service);
          // Clear the drafts for the saved keys and re-read the masked values.
          this.drafts.update((current) => {
            const next = { ...current };
            for (const key of Object.keys(values)) delete next[key];
            return next;
          });
          this.load();
        },
        error: (err: unknown) => {
          this.saving.set(null);
          this.error.set(apiErrorMessage(err));
        },
      });
  }

  isPlaceholder(masked: string): boolean {
    return masked === PLACEHOLDER || masked.trim() === '';
  }
}
