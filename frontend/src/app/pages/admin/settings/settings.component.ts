import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ServiceSettings } from '../../../core/models';

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
  readonly placeholder = PLACEHOLDER;

  /** Backend-owned data. Wired to GET /api/admin/settings by the service layer. */
  readonly services = signal<ServiceSettings[]>([
    {
      service: 'postgresql',
      label: 'PostgreSQL',
      description: 'Primary datastore holding items, locations, stock levels and the movement audit log.',
      configured: true,
      settings: [
        { key: 'DATABASE_URL', value: '', maskedValue: 'postgresql://stockroom:••••••••@db:5432/stockroom', configured: true, updatedAt: '2026-09-01T09:12:00Z' },
      ],
    },
    {
      service: 'minio',
      label: 'MinIO object storage',
      description: 'Provisioned for future attachments such as delivery notes and photographs. No feature reads it yet.',
      configured: false,
      settings: [
        { key: 'MINIO_ENDPOINT', value: '', maskedValue: PLACEHOLDER, configured: false },
        { key: 'MINIO_ACCESS_KEY', value: '', maskedValue: PLACEHOLDER, configured: false },
        { key: 'MINIO_SECRET_KEY', value: '', maskedValue: PLACEHOLDER, configured: false },
        { key: 'MINIO_BUCKET', value: '', maskedValue: PLACEHOLDER, configured: false },
      ],
    },
  ]);

  readonly drafts = signal<Record<string, string>>({});
  readonly savedService = signal<string | null>(null);

  readonly unconfigured = computed(() => this.services().filter((s) => !s.configured));
  readonly unconfiguredNames = computed(() => this.unconfigured().map((s) => s.label).join(', '));

  draftFor(key: string): string {
    return this.drafts()[key] ?? '';
  }

  setDraft(key: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [key]: value }));
    this.savedService.set(null);
  }

  save(service: ServiceSettings): void {
    this.savedService.set(service.service);
  }

  isPlaceholder(masked: string): boolean {
    return masked === PLACEHOLDER || masked.trim() === '';
  }
}
