import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PLACEHOLDER, isUnset, resolveConfig } from '../lib/config';
import { ALLOWED_SETTING_KEYS, SERVICE_CATALOG } from './settings.catalog';

export interface SettingView {
  key: string;
  /** Always empty. The plaintext never leaves the server. */
  value: string;
  maskedValue: string;
  configured: boolean;
  updatedAt?: string;
}

export interface ServiceSettingsView {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  settings: SettingView[];
}

/**
 * Renders a credential as something an admin can recognise without exposing it:
 * a URL keeps its scheme/host but loses its password, anything else keeps at
 * most a four-character tail. An unset key renders as the placeholder.
 */
function mask(value: string | null): string {
  if (isUnset(value)) return PLACEHOLDER;
  const raw = value as string;
  const url = tryParseUrl(raw);
  if (url) {
    const user = url.username ? `${url.username}:••••••••@` : '';
    return `${url.protocol}//${user}${url.host}${url.pathname}`;
  }
  return raw.length <= 4 ? '••••' : `••••••••${raw.slice(-4)}`;
}

function tryParseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol && url.host ? url : null;
  } catch {
    return null;
  }
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ServiceSettingsView[]> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...ALLOWED_SETTING_KEYS] } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return Promise.all(
      SERVICE_CATALOG.map(async (service) => {
        const settings = await Promise.all(
          service.keys.map(async (key) => {
            const resolved = await resolveConfig(this.prisma, key);
            const row = byKey.get(key);
            return {
              key,
              value: '',
              maskedValue: mask(resolved),
              configured: resolved !== null,
              updatedAt: row?.updatedAt.toISOString(),
            };
          }),
        );
        return {
          service: service.service,
          label: service.label,
          description: service.description,
          configured: settings.every((s) => s.configured),
          settings,
        };
      }),
    );
  }

  /**
   * Upserts the supplied key/value pairs. Unknown keys are rejected rather than
   * silently ignored, so a typo surfaces immediately instead of leaving the
   * admin believing a credential was saved.
   */
  async update(body: unknown): Promise<{ updated: string[] }> {
    const entries = this.parse(body);
    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );
    return { updated: entries.map(([key]) => key) };
  }

  private parse(body: unknown): Array<[string, string]> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException(
        'Body must be an object of setting key/value pairs',
      );
    }
    const entries = Object.entries(body as Record<string, unknown>);
    if (entries.length === 0) {
      throw new BadRequestException('No settings supplied');
    }
    return entries.map(([key, value]) => {
      if (!ALLOWED_SETTING_KEYS.has(key)) {
        throw new BadRequestException(`Unknown setting key: ${key}`);
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`Value for ${key} must be a string`);
      }
      return [key, value] as [string, string];
    });
  }
}
