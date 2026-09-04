import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Location, Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { LocationsService, LocationView } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  /** Clerk-readable on purpose: the movement form's From/To selects need it. */
  @Get()
  findAll(): Promise<LocationView[]> {
    return this.locations.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LocationView> {
    return this.locations.findOne(id);
  }

  @Roles(Role.manager)
  @Post()
  create(@Body() dto: CreateLocationDto): Promise<Location> {
    return this.locations.create(dto);
  }

  @Roles(Role.manager)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto): Promise<Location> {
    return this.locations.update(id, dto);
  }

  @Roles(Role.manager)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ id: string; deleted: true }> {
    return this.locations.remove(id);
  }
}
