import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LowStockRow {
  item: { id: string; sku: string; name: string; unit: string };
  totalQty: number;
  reorderAt: number;
  shortfall: number;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `totalQty` is summed across *every* location before the comparison, so an
   * item split 6/6 across two zones with a reorder point of 10 is correctly not
   * low on stock. The predicate is `<=`, so an item sitting exactly on its
   * reorder point is reported.
   */
  async lowStock(): Promise<LowStockRow[]> {
    const items = await this.prisma.item.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        reorderAt: true,
        stockLevels: { select: { qty: true } },
      },
    });

    return items
      .map((item) => {
        const totalQty = item.stockLevels.reduce((sum, l) => sum + l.qty, 0);
        return {
          item: {
            id: item.id,
            sku: item.sku,
            name: item.name,
            unit: item.unit,
          },
          totalQty,
          reorderAt: item.reorderAt,
          shortfall: item.reorderAt - totalQty,
        };
      })
      .filter((row) => row.totalQty <= row.reorderAt)
      .sort(
        (a, b) =>
          b.shortfall - a.shortfall || a.item.sku.localeCompare(b.item.sku),
      );
  }
}
