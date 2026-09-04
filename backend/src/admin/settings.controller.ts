import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { ServiceSettingsView, SettingsService } from './settings.service';

/** `manager` is the admin-equivalent role in StockRoom. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.manager)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list(): Promise<ServiceSettingsView[]> {
    return this.settings.list();
  }

  @Patch()
  update(@Body() body: unknown): Promise<{ updated: string[] }> {
    return this.settings.update(body);
  }
}
