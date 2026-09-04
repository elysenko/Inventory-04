/**
 * The backing services this deployment is provisioned with, and the keys each
 * one needs. Only keys listed here may be written through the admin panel — an
 * allowlist, so a PATCH cannot be used to inject arbitrary rows into
 * `system_settings` and shadow application config.
 */
export interface ServiceDefinition {
  service: string;
  label: string;
  description: string;
  keys: string[];
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    service: 'postgresql',
    label: 'PostgreSQL',
    description:
      'Primary datastore holding items, locations, stock levels and the movement audit log.',
    keys: ['DATABASE_URL'],
  },
  {
    service: 'minio',
    label: 'MinIO object storage',
    description:
      'Provisioned for future attachments such as delivery notes and photographs. No feature reads it yet.',
    keys: [
      'MINIO_ENDPOINT',
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
      'MINIO_BUCKET',
    ],
  },
];

export const ALLOWED_SETTING_KEYS: ReadonlySet<string> = new Set(
  SERVICE_CATALOG.flatMap((s) => s.keys),
);
