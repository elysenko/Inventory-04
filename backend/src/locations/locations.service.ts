import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Location } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rethrowPrisma } from '../common/prisma-error';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

const DUPLICATE_NAME = 'A location with that name already exists';

export interface LocationView {
  id: string;
  name: string;
  zone: string;
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<LocationView[]> {
    const locations = await this.prisma.location.findMany({
      select: { id: true, name: true, zone: true },
      orderBy: { name: 'asc' },
    });
    return locations;
  }

  async findOne(id: string): Promise<LocationView> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: { id: true, name: true, zone: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async create(dto: CreateLocationDto): Promise<Location> {
    try {
      return await this.prisma.location.create({ data: { ...dto } });
    } catch (error) {
      rethrowPrisma(error, { unique: DUPLICATE_NAME });
    }
  }

  /** Renaming touches no StockLevel row and reassigns no movement history. */
  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    try {
      return await this.prisma.location.update({
        where: { id },
        data: { ...dto },
      });
    } catch (error) {
      rethrowPrisma(error, {
        unique: DUPLICATE_NAME,
        notFound: 'Location not found',
      });
    }
  }

  /**
   * Blocked when the location holds stock or appears in the audit log as
   * either endpoint — both FK directions matter, since a TRANSFER references
   * one location as `fromLoc` and another as `toLoc`.
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      select: {
        id: true,
        _count: { select: { movementsFrom: true, movementsTo: true } },
      },
    });
    if (!location) throw new NotFoundException('Location not found');

    if (location._count.movementsFrom + location._count.movementsTo > 0) {
      throw new BadRequestException(
        'Cannot delete a location with movement history',
      );
    }
    const stocked = await this.prisma.stockLevel.count({
      where: { locationId: id, qty: { not: 0 } },
    });
    if (stocked > 0) {
      throw new BadRequestException('Cannot delete a location that holds stock');
    }

    try {
      await this.prisma.location.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error, {
        notFound: 'Location not found',
        fk: 'Cannot delete a location that is still referenced',
      });
    }
    return { id, deleted: true };
  }
}
