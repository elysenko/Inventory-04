import { BadRequestException, Injectable } from '@nestjs/common';
import { Movement, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { P2002_UNIQUE, isPrismaError } from '../common/prisma-error';
import type { CreateMovementDto } from './dto/create-movement.dto';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  QueryMovementsDto,
} from './dto/query-movements.dto';

const INSUFFICIENT_STOCK = 'Insufficient stock';

/** Relations the audit log exposes: actor email, item, and both endpoints. */
const MOVEMENT_INCLUDE = {
  user: { select: { email: true } },
  item: { select: { id: true, sku: true, name: true, unit: true } },
  fromLoc: { select: { id: true, name: true, zone: true } },
  toLoc: { select: { id: true, name: true, zone: true } },
} satisfies Prisma.MovementInclude;

export type MovementView = Prisma.MovementGetPayload<{
  include: typeof MOVEMENT_INCLUDE;
}>;

export interface PaginatedMovements {
  data: MovementView[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies the balance change and writes the audit row inside a single
   * transaction, so the two can never disagree: if the guard below rejects the
   * movement, the whole transaction rolls back and neither the balance nor the
   * log records anything.
   */
  async create(dto: CreateMovementDto, userId: string): Promise<Movement> {
    const { type, itemId, qty, note } = dto;
    const fromLocId = dto.fromLocId ?? null;
    const toLocId = dto.toLocId ?? null;

    // Validate the referenced rows up front so a bad id surfaces as a 400 with
    // a useful message rather than a raw foreign-key error from the insert.
    await this.assertReferencesExist(itemId, fromLocId, toLocId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (fromLocId) await this.decrement(tx, itemId, fromLocId, qty);
        if (toLocId) await this.increment(tx, itemId, toLocId, qty);

        return tx.movement.create({
          data: {
            type,
            itemId,
            fromLocId,
            toLocId,
            qty,
            note: note ?? null,
            // Stamped from the JWT, never from the request body.
            userId,
          },
        });
      });
    } catch (error) {
      if (isPrismaError(error, 'P2003')) {
        throw new BadRequestException('Referenced item or location not found');
      }
      throw error;
    }
  }

  /**
   * The availability test lives in the WHERE clause, so the check and the write
   * are one statement — there is no read-then-write window for a concurrent OUT
   * to slip through. When no row matches (not enough stock, or no stock row at
   * this location at all) `count` is 0 and we roll the transaction back.
   */
  private async decrement(
    tx: Prisma.TransactionClient,
    itemId: string,
    locationId: string,
    qty: number,
  ): Promise<void> {
    const result = await tx.stockLevel.updateMany({
      where: { itemId, locationId, qty: { gte: qty } },
      data: { qty: { decrement: qty } },
    });
    if (result.count === 0) throw new BadRequestException(INSUFFICIENT_STOCK);
  }

  /**
   * Upsert creates the (item, location) row on first stock-in. For a compound
   * unique with no nested writes Prisma emits a native INSERT ... ON CONFLICT
   * DO UPDATE, so two concurrent first-time INs are already serialised by the
   * database. The P2002 retry is the fallback for the query shapes where Prisma
   * falls back to SELECT-then-INSERT and the loser of that race would otherwise
   * surface a 500.
   */
  private async increment(
    tx: Prisma.TransactionClient,
    itemId: string,
    locationId: string,
    qty: number,
  ): Promise<void> {
    const where = { itemId_locationId: { itemId, locationId } };
    try {
      await tx.stockLevel.upsert({
        where,
        create: { itemId, locationId, qty },
        update: { qty: { increment: qty } },
      });
    } catch (error) {
      if (!isPrismaError(error, P2002_UNIQUE)) throw error;
      await tx.stockLevel.update({
        where,
        data: { qty: { increment: qty } },
      });
    }
  }

  private async assertReferencesExist(
    itemId: string,
    fromLocId: string | null,
    toLocId: string | null,
  ): Promise<void> {
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    if (!item) throw new BadRequestException('Unknown itemId');

    const locationIds = [fromLocId, toLocId].filter(
      (id): id is string => id !== null,
    );
    if (locationIds.length === 0) return;

    const found = await this.prisma.location.count({
      where: { id: { in: locationIds } },
    });
    if (found !== new Set(locationIds).size) {
      throw new BadRequestException('Unknown location');
    }
  }

  async findAll(query: QueryMovementsDto): Promise<PaginatedMovements> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const where: Prisma.MovementWhereInput = {};
    if (query.itemId) where.itemId = query.itemId;
    if (query.type) where.type = query.type;
    if (query.from || query.to) {
      // Inclusive on both ends: a row stamped exactly at `from` is included.
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.movement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }
}
