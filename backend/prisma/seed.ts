/**
 * Idempotent StockRoom seed. The container entrypoint runs this on every start,
 * so every write is an upsert keyed on a natural unique column, and the opening
 * stock / historical movements are guarded by an existence check — a restart
 * must never inflate balances or duplicate audit rows.
 */
import { MovementType, PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'Demo1234!';

const USERS: Array<{ email: string; role: Role }> = [
  { email: 'manager@demo', role: Role.manager },
  { email: 'clerk@demo', role: Role.clerk },
];

const LOCATIONS: Array<{ name: string; zone: string }> = [
  { name: 'Zone A', zone: 'A' },
  { name: 'Zone B', zone: 'B' },
  { name: 'Zone C', zone: 'C' },
];

interface SeedItem {
  sku: string;
  name: string;
  description: string;
  unit: string;
  reorderAt: number;
  /** Opening balances by location name. */
  opening: Record<string, number>;
}

/**
 * Balances are chosen so the fixtures the UI and tests rely on always exist:
 *   - SR-1001 is stocked in two locations (per-location breakdown demo)
 *   - SR-1004, SR-1006 and SR-1008 sit at or below reorderAt, so the low-stock
 *     report is non-empty on a fresh boot
 *   - SR-1008 has no stock at all, exercising the totalQty === 0 path
 */
const ITEMS: SeedItem[] = [
  { sku: 'SR-1001', name: 'Hex Bolt M8 x 40', description: 'Zinc-plated hex bolt.', unit: 'ea', reorderAt: 100, opening: { 'Zone A': 140, 'Zone B': 60 } },
  { sku: 'SR-1002', name: 'Nylon Lock Nut M8', description: 'Nyloc nut, DIN 985.', unit: 'ea', reorderAt: 150, opening: { 'Zone A': 420 } },
  { sku: 'SR-1003', name: 'Flat Washer M8', description: 'Stainless flat washer.', unit: 'ea', reorderAt: 200, opening: { 'Zone B': 610 } },
  { sku: 'SR-1004', name: 'Cable Tie 200mm', description: 'UV-stable black cable tie.', unit: 'pack', reorderAt: 40, opening: { 'Zone A': 12, 'Zone C': 6 } },
  { sku: 'SR-1005', name: 'Shipping Carton 400x300', description: 'Double-wall carton.', unit: 'ea', reorderAt: 75, opening: { 'Zone C': 260 } },
  { sku: 'SR-1006', name: 'Packing Tape 48mm', description: 'Low-noise acrylic tape.', unit: 'roll', reorderAt: 60, opening: { 'Zone B': 60 } },
  { sku: 'SR-1007', name: 'Pallet Wrap 500mm', description: 'Hand-applied stretch film.', unit: 'roll', reorderAt: 25, opening: { 'Zone C': 90 } },
  { sku: 'SR-1008', name: 'Thermal Label 100x150', description: 'Direct thermal shipping label.', unit: 'box', reorderAt: 30, opening: {} },
];

async function seedUsers(): Promise<Record<string, string>> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const ids: Record<string, string> = {};
  for (const user of USERS) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      // Password and role are re-asserted so a re-seed repairs a drifted row.
      update: { role: user.role, passwordHash },
      create: { email: user.email, role: user.role, passwordHash },
    });
    ids[user.email] = row.id;
    console.log(`SEED_CRED ${user.role} ${user.email} ${DEMO_PASSWORD}`);
  }
  return ids;
}

async function seedLocations(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const location of LOCATIONS) {
    const row = await prisma.location.upsert({
      where: { name: location.name },
      update: { zone: location.zone },
      create: location,
    });
    ids[location.name] = row.id;
  }
  return ids;
}

async function seedItems(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const item of ITEMS) {
    const row = await prisma.item.upsert({
      where: { sku: item.sku },
      update: {
        name: item.name,
        description: item.description,
        unit: item.unit,
        reorderAt: item.reorderAt,
      },
      create: {
        sku: item.sku,
        name: item.name,
        description: item.description,
        unit: item.unit,
        reorderAt: item.reorderAt,
      },
    });
    ids[item.sku] = row.id;
  }
  return ids;
}

/**
 * Creates opening balances only where no StockLevel row exists yet. Using
 * `create` rather than an upsert that sets `qty` means a re-seed leaves
 * whatever the application has since moved, instead of resetting it.
 */
async function seedOpeningStock(
  itemIds: Record<string, string>,
  locationIds: Record<string, string>,
): Promise<void> {
  for (const item of ITEMS) {
    for (const [locationName, qty] of Object.entries(item.opening)) {
      const itemId = itemIds[item.sku];
      const locationId = locationIds[locationName];
      const existing = await prisma.stockLevel.findUnique({
        where: { itemId_locationId: { itemId, locationId } },
      });
      if (existing) continue;
      await prisma.stockLevel.create({ data: { itemId, locationId, qty } });
    }
  }
}

/**
 * A handful of historical rows so the audit log and its filters render on a
 * fresh boot. Skipped entirely once any movement exists, so restarts never
 * duplicate history — and because these are written directly rather than
 * through MovementsService, they intentionally do not alter the balances above.
 */
async function seedMovementHistory(
  itemIds: Record<string, string>,
  locationIds: Record<string, string>,
  userIds: Record<string, string>,
): Promise<void> {
  if ((await prisma.movement.count()) > 0) {
    console.log('Movement history already present — skipping');
    return;
  }

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  interface HistoryRow {
    type: MovementType;
    sku: string;
    from?: string;
    to?: string;
    qty: number;
    note: string;
    actor: string;
    daysAgo: number;
  }

  const history: HistoryRow[] = [
    { type: MovementType.IN, sku: 'SR-1001', to: 'Zone A', qty: 200, note: 'Opening receipt', actor: 'manager@demo', daysAgo: 9 },
    { type: MovementType.OUT, sku: 'SR-1001', from: 'Zone A', qty: 60, note: 'Order #4471', actor: 'clerk@demo', daysAgo: 7 },
    { type: MovementType.TRANSFER, sku: 'SR-1001', from: 'Zone A', to: 'Zone B', qty: 60, note: 'Rebalance', actor: 'clerk@demo', daysAgo: 5 },
    { type: MovementType.IN, sku: 'SR-1005', to: 'Zone C', qty: 260, note: 'Pallet delivery', actor: 'manager@demo', daysAgo: 4 },
    { type: MovementType.OUT, sku: 'SR-1004', from: 'Zone A', qty: 8, note: 'Line replenishment', actor: 'clerk@demo', daysAgo: 2 },
    { type: MovementType.IN, sku: 'SR-1006', to: 'Zone B', qty: 60, note: 'Restock', actor: 'manager@demo', daysAgo: 1 },
  ];

  for (const row of history) {
    await prisma.movement.create({
      data: {
        type: row.type,
        itemId: itemIds[row.sku],
        fromLocId: row.from ? locationIds[row.from] : null,
        toLocId: row.to ? locationIds[row.to] : null,
        qty: row.qty,
        note: row.note,
        userId: userIds[row.actor],
        createdAt: new Date(now - row.daysAgo * day),
      },
    });
  }
}

async function main(): Promise<void> {
  const userIds = await seedUsers();
  const locationIds = await seedLocations();
  const itemIds = await seedItems();
  await seedOpeningStock(itemIds, locationIds);
  await seedMovementHistory(itemIds, locationIds, userIds);
  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
