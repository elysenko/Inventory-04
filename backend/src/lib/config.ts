import { PrismaClient } from '@prisma/client';

/**
 * Written into a SystemSetting row (or an env var) to mean "this key exists but
 * has not been configured yet". Treated as absent everywhere.
 */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

export function isUnset(value: string | null | undefined): boolean {
  return !value || value.trim() === '' || value === PLACEHOLDER;
}

/**
 * Resolves a service credential, in priority order:
 *   1. the environment variable (what the platform mounts at deploy time)
 *   2. the SystemSetting row an admin saved through /admin/settings
 *   3. null — the feature is unconfigured
 *
 * Callers must treat null as "degrade this feature" (503 from the specific
 * endpoint), never as a reason to crash at boot: the platform provisions no
 * third-party keys, so a hard requirement here would crash-loop the pod.
 */
export async function resolveConfig(
  prisma: PrismaClient | { systemSetting: PrismaClient['systemSetting'] },
  key: string,
): Promise<string | null> {
  const fromEnv = process.env[key];
  if (!isUnset(fromEnv)) return fromEnv as string;

  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!isUnset(row?.value)) return row!.value;

  return null;
}

/** Raised by a feature whose credential resolved to null. Maps to HTTP 503. */
export class ServiceUnconfiguredError extends Error {
  constructor(public readonly key: string) {
    super(`${key} is not configured`);
    this.name = 'ServiceUnconfiguredError';
  }
}
