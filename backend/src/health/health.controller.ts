import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness only — deliberately touches nothing. Kubernetes must not restart a
   * healthy pod because Postgres briefly went away.
   */
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: proves the process can actually reach the database. */
  @Get('deep')
  async deep(): Promise<{ status: 'ok'; db: 'up' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch (error) {
      this.logger.error('Deep health check failed', error as Error);
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        status: 'error',
        db: 'down',
        message: 'Database unreachable',
      });
    }
  }
}
