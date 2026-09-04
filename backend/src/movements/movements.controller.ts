import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Movement, Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth-user';
import { MovementsService, PaginatedMovements } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';

@ApiTags('movements')
@ApiBearerAuth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  /** Both roles may record stock movements — entry is not manager-gated. */
  @Post()
  create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Movement> {
    return this.movements.create(dto, user.id);
  }

  /** The audit log is manager-only. */
  @Roles(Role.manager)
  @Get()
  findAll(@Query() query: QueryMovementsDto): Promise<PaginatedMovements> {
    return this.movements.findAll(query);
  }
}
