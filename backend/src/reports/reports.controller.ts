import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { LowStockRow, ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Roles(Role.manager)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('low-stock')
  lowStock(): Promise<LowStockRow[]> {
    return this.reports.lowStock();
  }
}
