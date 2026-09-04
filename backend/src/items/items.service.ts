import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rethrowPrisma } from '../common/prisma-error';
import type { CreateItemDto } from './dto/create-item.dto';
import type { UpdateItemDto } from './dto/update-item.dto';
import type { QueryItemsDto } from './dto/query-items.dto';

const DUPLICATE_SKU = 'SKU already exists';

/** Scalar item fields plus the derived total; `totalQty` is never stored. */
export interface ItemView {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  totalQty: number;
}

export interface ItemDetailView extends ItemView {
  stockLevels: Array<{
    id: string;
    itemId: string;
    locationId: string;
    qty: number;
    location: { id: string; name: string; zone: string };
  }>;
}

const LOCATION_SELECT = { id: true, name: true, zone: true } as const;

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryItemsDto): Promise<ItemView[]> {
    const where: Prisma.ItemWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { sku: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};

    const items = await this.prisma.item.findMany({
      where,
      include: { stockLevels: { select: { qty: true } } },
      orderBy: { sku: 'asc' },
    });

    const views = items.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      reorderAt: item.reorderAt,
      totalQty: sumQty(item.stockLevels),
    }));

    // Filtering after the sum because the predicate compares a derived
    // aggregate against a column — not expressible in a Prisma `where`.
    return query.lowStock === true
      ? views.filter((v) => v.totalQty <= v.reorderAt)
      : views;
  }

  async findOne(id: string): Promise<ItemDetailView> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        stockLevels: {
          include: { location: { select: LOCATION_SELECT } },
          orderBy: { location: { name: 'asc' } },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      reorderAt: item.reorderAt,
      totalQty: sumQty(item.stockLevels),
      stockLevels: item.stockLevels.map((level) => ({
        id: level.id,
        itemId: level.itemId,
        locationId: level.locationId,
        qty: level.qty,
        location: level.location,
      })),
    };
  }

  async create(dto: CreateItemDto): Promise<ItemView> {
    try {
      const item = await this.prisma.item.create({ data: { ...dto } });
      return { ...stripItem(item), totalQty: 0 };
    } catch (error) {
      rethrowPrisma(error, { unique: DUPLICATE_SKU });
    }
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemView> {
    try {
      const item = await this.prisma.item.update({
        where: { id },
        data: { ...dto },
        include: { stockLevels: { select: { qty: true } } },
      });
      return { ...stripItem(item), totalQty: sumQty(item.stockLevels) };
    } catch (error) {
      rethrowPrisma(error, { unique: DUPLICATE_SKU, notFound: 'Item not found' });
    }
  }

  /**
   * Refuses the delete rather than cascading: the movement log is append-only
   * evidence, and dropping stock rows would silently rewrite balances.
   */
  async remove(id: string): Promise<{ id: string; deleted: true }> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      select: { id: true, _count: { select: { movements: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');

    if (item._count.movements > 0) {
      throw new BadRequestException(
        'Cannot delete an item with movement history',
      );
    }
    const stocked = await this.prisma.stockLevel.count({
      where: { itemId: id, qty: { not: 0 } },
    });
    if (stocked > 0) {
      throw new BadRequestException('Cannot delete an item that holds stock');
    }

    try {
      await this.prisma.item.delete({ where: { id } });
    } catch (error) {
      rethrowPrisma(error, {
        notFound: 'Item not found',
        fk: 'Cannot delete an item that is still referenced',
      });
    }
    return { id, deleted: true };
  }
}

function sumQty(levels: Array<{ qty: number }>): number {
  return levels.reduce((total, level) => total + level.qty, 0);
}

function stripItem(item: {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
}): Omit<ItemView, 'totalQty'> {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    unit: item.unit,
    reorderAt: item.reorderAt,
  };
}
