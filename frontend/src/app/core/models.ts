/** Shared API response shapes for StockRoom. Mirrors the REST surface under /api. */

export type Role = 'clerk' | 'manager';
export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  /** Display name captured at signup; absent for the seeded demo accounts. */
  name?: string | null;
  role: Role;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Location {
  id: string;
  name: string;
  zone: string;
}

/** Per-location on-hand quantity for a single item. */
export interface StockLevel {
  id: string;
  itemId: string;
  locationId: string;
  qty: number;
  location?: Location;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  reorderAt: number;
  /** Derived server-side from the sum of stockLevels. */
  totalQty: number;
  stockLevels?: StockLevel[];
}

export interface Movement {
  id: string;
  type: MovementType;
  itemId: string;
  item?: Pick<Item, 'id' | 'sku' | 'name' | 'unit'>;
  fromLocId?: string | null;
  toLocId?: string | null;
  fromLoc?: Location | null;
  toLoc?: Location | null;
  qty: number;
  note?: string | null;
  userId: string;
  user?: { email: string; name?: string | null };
  createdAt: string;
}

export interface LowStockRow {
  item: Pick<Item, 'id' | 'sku' | 'name' | 'unit'>;
  totalQty: number;
  reorderAt: number;
  shortfall: number;
}

export interface SystemSetting {
  key: string;
  value: string;
  maskedValue: string;
  configured: boolean;
  updatedAt?: string;
}

/** One provisioned backing service and the settings keys it needs. */
export interface ServiceSettings {
  service: string;
  label: string;
  description: string;
  configured: boolean;
  settings: SystemSetting[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementFilters {
  itemId?: string;
  type?: MovementType | '';
  from?: string;
  to?: string;
  page?: number;
}

/** Normalised client-side error shape produced from `{ message }` envelopes. */
export interface ApiError {
  status: number;
  message: string;
  field?: string;
}

export const MOVEMENT_TYPES: readonly MovementType[] = ['IN', 'OUT', 'TRANSFER'] as const;
