# Pipeline Task Decomposition

## Summary
StockRoom is a greenfield inventory-management application: a NestJS 11 + Prisma 6 (PostgreSQL) REST API under the `/api` global prefix, plus an Angular standalone SPA. Two authenticated actor roles — `clerk` and `manager` — share a catalog of items and locations. Stock is tracked per `(item, location)` pair in `StockLevel` rows and is only ever mutated through atomic `IN` / `OUT` / `TRANSFER` movements executed inside a single Prisma transaction with a guarded `updateMany` so concurrent OUTs can never drive a balance negative. Managers additionally get catalog/location CRUD, a filterable movement audit log, and a low-stock report (`SUM(stockLevel.qty) <= item.reorderAt`). The brand string **StockRoom** must render on the unauthenticated `/login` view because the root URL redirects unauthenticated visitors there and the smoke oracle asserts on it.

## Surface contract

### Backend REST routes (all under global prefix `/api`)
| Method | Route | Access | Notes |
|---|---|---|---|
| GET | `/api/health` | public | liveness |
| GET | `/api/health/deep` | public | runs `SELECT 1`; `{status:'ok', db:'up'}`, 503 on failure |
| POST | `/api/auth/login` | public | `{email, password}` → `{token, user}` |
| POST | `/api/auth/signup` | public | creates **role=clerk only** |
| GET | `/api/auth/me` | authenticated | current user record |
| GET | `/api/items` | clerk + manager | each item carries derived `totalQty` |
| GET | `/api/items/:id` | clerk + manager | adds `stockLevels: [{location, qty}]` |
| POST | `/api/items` | manager | duplicate `sku` → 400 `SKU already exists` |
| PATCH | `/api/items/:id` | manager | |
| DELETE | `/api/items/:id` | manager | 400 if stock or movement history exists |
| GET | `/api/locations` | clerk + manager | needed to populate movement-form selects |
| POST/PATCH/DELETE | `/api/locations[/:id]` | manager | delete blocked when referenced |
| POST | `/api/movements` | clerk + manager | atomic IN/OUT/TRANSFER |
| GET | `/api/movements` | manager | filters `itemId`, `type`, `from`, `to`, `page`; ordered `createdAt desc` |
| GET | `/api/reports/low-stock` | manager | `{item, totalQty, reorderAt, shortfall}` sorted by shortfall desc |
| GET | `/api/admin/settings` | manager (admin-equivalent) | service keys + masked values + configured status |
| PATCH | `/api/admin/settings` | manager (admin-equivalent) | upsert key/value pairs |

Status contract: missing/invalid token → **401**; role denial → **403**; validation failure (duplicate SKU, insufficient stock, bad movement shape) → **400** with `{message}`.

### Frontend routes (every state URL-addressable, each entry carries `data.flow`)
`/login` (public), `/signup` (public), `/` → redirect `/items`, `/items` (`authGuard`, `?q=` + `?lowStock=` bound to query params), `/items/new` (`roleGuard('manager')`), `/items/:id`, `/items/:id/edit` (`roleGuard('manager')`), `/locations`, `/locations/new`, `/locations/:id/edit` (all `roleGuard('manager')`), `/movements/new` (`authGuard`), `/movements` (`roleGuard('manager')`, filters `?itemId=&type=&from=&to=&page=` restored from URL on load), `/reports/low-stock` (`roleGuard('manager')`), `/admin/settings` (`roleGuard('manager')`), `**` → `/items`.

### Entities
`User(id, email @unique, passwordHash, role Role)`, `Item(id, sku @unique, name, description?, unit, reorderAt Int)`, `Location(id, name @unique, zone)`, `StockLevel(id, itemId, locationId, qty Int @default(0), @@unique([itemId, locationId]))`, `Movement(id, type MovementType, itemId, fromLocId?, toLocId?, qty Int, note?, userId, createdAt)`, `SystemSetting(key @id, value, updatedAt)`. Enums: `Role { clerk manager }`, `MovementType { IN OUT TRANSFER }`.

## db_agent tasks
- [ ] Repoint `backend/package.json` Prisma dependencies from the scaffolded `^7.0.0` to `prisma@^6` and `@prisma/client@^6` (Prisma 7 is ESM-only and breaks the NestJS CommonJS build); never run `prisma@latest` codegen.
- [ ] Rewrite `backend/prisma/schema.prisma`: replace the scaffolded `User`/`Role` template model with `enum Role { clerk manager }` and `enum MovementType { IN OUT TRANSFER }`.
- [ ] Add `User(id String @id @default(cuid()), email String @unique, passwordHash String, role Role, createdAt, updatedAt)` — `role` has **no default**; signup assigns `clerk` explicitly in the service layer.
- [ ] Add `Item(id, sku String @unique, name, description String?, unit, reorderAt Int)` and `Location(id, name String @unique, zone)`.
- [ ] Add `StockLevel(id, itemId, locationId, qty Int @default(0))` with `@@unique([itemId, locationId])` and relations to `Item` and `Location`.
- [ ] Add `Movement(id, type MovementType, itemId, fromLocId String?, toLocId String?, qty Int, note String?, userId, createdAt DateTime @default(now()))` with `@@index([itemId])`, `@@index([createdAt])`, and **explicit named relations** `fromLoc`/`toLoc` to `Location` (two FKs to the same model — omitting names is a `prisma validate` error).
- [ ] Add `SystemSetting(key String @id, value String, updatedAt DateTime @updatedAt)` for admin-configurable backing-service credentials.
- [ ] Run `prisma migrate dev --name init` and commit the generated migration under `backend/prisma/migrations/`.
- [ ] Rewrite `backend/prisma/seed.ts` (and delete the scaffolded `prisma/seed/seed.js`): idempotent `upsert`s for `manager@demo` (manager) and `clerk@demo` (clerk), both password `Demo1234!` hashed with `bcryptjs`.
- [ ] Seed locations `Zone A`/`Zone B`/`Zone C` (zones `A`/`B`/`C`) upserted on `name`, and 8 items upserted on `sku` with varied `reorderAt`.
- [ ] Seed opening `StockLevel` rows so at least one item sits at or below its `reorderAt` (low-stock report non-empty on fresh boot) and at least one item is stocked in two locations (per-location breakdown demoable); guard stock/movement inserts so container restarts do not inflate balances or duplicate audit rows.
- [ ] Seed a handful of historical `Movement` rows so the audit log renders, and set `"prisma": {"seed": "ts-node prisma/seed.ts"}` in `backend/package.json`.

## backend_agent tasks
- [ ] Replace the scaffolded tRPC stack: delete `src/trpc/*`, `src/users/users.router.ts`, and the `@trpc/server`/`nestjs-trpc` dependencies; the API surface is REST-only.
- [ ] Update `src/main.ts` to call `app.setGlobalPrefix('api')` and register a global `ValidationPipe({whitelist: true, transform: true})`, keeping CORS.
- [ ] Add backend deps: `@nestjs/passport`, `passport`, `passport-jwt`, `class-validator`, `class-transformer`, `bcryptjs`, `@types/bcryptjs`; dev `jest`, `supertest`, `ts-node`.
- [ ] Make `PrismaModule` `@Global()` and have `PrismaService extends PrismaClient implements OnModuleInit` call `$connect()`.
- [ ] Implement `src/health/health.controller.ts`: `@Public()` `GET /api/health` and `GET /api/health/deep` (`$queryRaw\`SELECT 1\`` → `{status:'ok', db:'up'}`, 503 on failure).
- [ ] Build `src/auth/`: `auth.module.ts`, `auth.service.ts` (`validate()` via `bcrypt.compare`, `login()` signs `{sub, email, role}`, 24h expiry), `jwt.strategy.ts`, `dto/login.dto.ts`, `dto/signup.dto.ts`.
- [ ] Add `public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`, `jwt-auth.guard.ts`, `roles.guard.ts`; register `JwtAuthGuard` + `RolesGuard` as `APP_GUARD` providers in `AppModule` so every endpoint is protected by default (401 globally) and `@Public()` opts out.
- [ ] Implement `auth.controller.ts`: `POST /api/auth/login`, `POST /api/auth/signup` (both `@Public()`; signup always assigns `role: 'clerk'`), `GET /api/auth/me`.
- [ ] Implement `src/items/` module/controller/service + create/update DTOs: `GET /api/items` returns each item with `totalQty` derived from included `stockLevels`; `GET /api/items/:id` adds `stockLevels: [{location, qty}]`.
- [ ] Guard item `POST`/`PATCH`/`DELETE` with `@Roles('manager')`; map Prisma `P2002` on `sku` → `BadRequestException('SKU already exists')`; refuse delete with 400 when stock or movement history references the item.
- [ ] Implement `src/locations/` mirroring items (`GET /api/locations` readable by clerks; mutations `@Roles('manager')`; delete blocked when referenced by stock or movements).
- [ ] Implement `dto/create-movement.dto.ts` with per-type validation: `IN` requires `toLocId` and forbids `fromLocId`; `OUT` requires `fromLocId`; `TRANSFER` requires both with `fromLocId !== toLocId`; `qty` is `@IsInt() @Min(1)`.
- [ ] Implement `movements.service.create()` entirely inside `prisma.$transaction(async (tx) => …)`: decrement source via the guarded `tx.stockLevel.updateMany({ where: { itemId, locationId: fromLocId, qty: { gte: qty } }, data: { qty: { decrement: qty } } })` and throw `BadRequestException('Insufficient stock')` when `count === 0` (no read-then-write window; the throw rolls back).
- [ ] In the same transaction, increment the destination with `tx.stockLevel.upsert({ where: { itemId_locationId: {…} }, create: { qty }, update: { qty: { increment: qty } } })`, catching `P2002` and retrying once as a plain `update`; write the `Movement` row stamped with the authenticated `userId`.
- [ ] Implement `GET /api/movements` with `@Roles('manager')` and `dto/query-movements.dto.ts`: filters `itemId`, `type`, `from`/`to` (as `createdAt` `gte`/`lte`), pagination, `include: { user: { select: { email } }, item, fromLoc, toLoc }`, ordered `createdAt desc`.
- [ ] Implement `src/reports/` — `GET /api/reports/low-stock` `@Roles('manager')`: compute `totalQty` per item from `stockLevels`, keep `totalQty <= reorderAt`, return `{item, totalQty, reorderAt, shortfall}` sorted by shortfall descending.
- [ ] Add `src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; if absent or equal to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, falls back to the `SystemSetting` row; returns `null` when neither is set.
- [ ] Implement `GET /api/admin/settings` (lists the keys for the provisioned backing services `postgresql` and `minio` with masked values + configured status) and `PATCH /api/admin/settings` (upserts key/value pairs), both restricted to the admin-equivalent `manager` role.
- [ ] Update `backend/Dockerfile`: multi-stage `node:22-alpine`, `npm ci` → `npx prisma generate` → `nest build`; runtime stage copies `node_modules/.prisma` and `node_modules/@prisma` explicitly; entrypoint `npx prisma migrate deploy && npx prisma db seed && node dist/main.js`.
- [ ] Rewrite root `docker-compose.yml` for StockRoom: `db` (`postgres:18-alpine`, `pg_isready` healthcheck), `backend` (`depends_on: db: condition: service_healthy`), `frontend`; `DATABASE_URL=postgresql://stockroom:stockroom@db:5432/stockroom`, `JWT_SECRET`; add `.env.example` and update `.gitignore`.
- [ ] Replace the `# Inventory-04` stub in `README.md` with StockRoom setup/run instructions (compose up, seeded demo credentials, health check URLs). Do not touch `.github/workflows/colossus-deploy.yml`.

## ui_agent tasks
- [ ] Remove the scaffolded tRPC frontend wiring (`@trpc/client`, `ngx-trpc`, `trpc-client.types.ts`, the `TRPC_CLIENT` token in `app.config.ts`) and add `@angular/material` + `@angular/forms` to `frontend/package.json`.
- [ ] Set `frontend/src/index.html` `<title>StockRoom</title>` and configure `app.config.ts` with `provideRouter(routes)`, `provideHttpClient(withInterceptors([authInterceptor]))`, `provideAnimations()`.
- [ ] Build `src/app/shell/shell.component.ts`: Material toolbar rendering the literal brand text **StockRoom**, role-aware nav, and logout; nav links for locations, movement log, low-stock report, and admin settings render only when `auth.user()?.role === 'manager'`.
- [ ] Build `pages/login/` — must render the literal heading text **StockRoom** on the unauthenticated view (the smoke oracle loads `/` and is redirected here); email/password form with inline error state.
- [ ] Build `pages/signup/` — public registration form; copy states that new accounts are created as clerks.
- [ ] Write `src/app/app.routes.ts` with the full route table from the Surface contract, each entry carrying `data.flow`, `/` redirecting to `/items`, and `**` → `/items`.
- [ ] Implement `core/auth.guard.ts` and `core/role.guard.ts` (`roleGuard('manager')`), redirecting unauthenticated visitors to `/login` and denied roles back to `/items`.
- [ ] Build `pages/items/item-list/` — Material table with columns sku, name, unit, reorderAt, totalQty; rows highlighted at/below threshold; `?q=` and `?lowStock=` bound to query params (filter state lives in the URL, never in component-only state); empty/loading/error states.
- [ ] Build `pages/items/item-detail/` — item fields plus the per-location `stockLevels` breakdown table.
- [ ] Build `pages/items/item-form/` — shared create/edit reactive form for `/items/new` and `/items/:id/edit`, surfacing the 400 `SKU already exists` message on the sku control.
- [ ] Build `pages/locations/location-list/` and `pages/locations/location-form/` (name, zone) with delete-blocked (400) error surfacing.
- [ ] Build `pages/movements/movement-form/` — item select, type radio (IN/OUT/TRANSFER), from/to location selects shown conditionally off the type control, qty, note; surfaces `Insufficient stock` 400s inline.
- [ ] Build `pages/movements/movement-log/` — paginated table of timestamp, actor email, item, type, qty, from/to; filter controls for `itemId`, `type`, `from`, `to`, `page` read from and written back to query params so deep links restore filter state on load.
- [ ] Build `pages/reports/low-stock/` — table of item, totalQty, reorderAt, shortfall sorted by shortfall descending, with an explicit empty state.
- [ ] Build `pages/admin/settings/` at `/admin/settings` — one section per provisioned backing service (`postgresql`, `minio`) with a configured/unconfigured badge and a credential form per service; render a prominent banner listing any services whose values are unset or `PLACEHOLDER_CONFIGURE_IN_SETTINGS`: "The following need credentials to activate: …". No integration credential fields (the spec declares no third-party integrations).
- [ ] Verify `frontend/Dockerfile` copies **`dist/frontend/browser`** (Angular 17+ output layout) into `nginx:alpine`, and that `nginx.conf` keeps `try_files $uri $uri/ /index.html;` plus the `/api` proxy to `http://backend:3000`.

## service_agent tasks
- [ ] Write `src/app/core/models.ts` — TypeScript interfaces for `User`, `Role`, `Item` (incl. `totalQty`), `Location`, `StockLevel`, `Movement`, `MovementType`, `LowStockRow`, `SystemSetting`, and paginated list envelopes, matching the backend response shapes exactly.
- [ ] Write `src/app/core/api.service.ts` — a single typed HTTP data layer over `/api` (base URL from environment; `/api` proxied by nginx in production and `proxy.conf.json` in dev).
- [ ] Add items methods: `listItems({q, lowStock})`, `getItem(id)`, `createItem`, `updateItem`, `deleteItem`.
- [ ] Add locations methods: `listLocations()`, `createLocation`, `updateLocation`, `deleteLocation`.
- [ ] Add movements methods: `createMovement(dto)` and `listMovements({itemId, type, from, to, page})` serialising filters to query params.
- [ ] Add reports + settings methods: `lowStock()`, `getAdminSettings()`, `updateAdminSettings(pairs)`.
- [ ] Write `src/app/core/auth.service.ts` — `login`, `signup`, `logout`, `me`; current user held in a signal and restored from `localStorage` on boot; JWT persisted in `localStorage` with 24h expiry awareness.
- [ ] Write `src/app/core/auth.interceptor.ts` — attaches `Authorization: Bearer <token>` to `/api` requests and routes 401 responses to `/login` after clearing stored auth state.
- [ ] Normalise backend error envelopes (`{message}` on 400, 403, 401) into a consistent client-side error shape the UI components can render inline.

## tester tasks
- [ ] Set up Jest + supertest e2e harness under `backend/test/` with one `*.e2e-spec.ts` per spec requirement, plus a Playwright config for the frontend smoke suite.
- [ ] e2e: every non-public endpoint returns **401** with no token; `/api/health` and `/api/health/deep` are reachable unauthenticated and `/deep` reports `db: up`.
- [ ] e2e: clerk `POST /api/items` → **403**; manager succeeds.
- [ ] e2e: duplicate `sku` → **400** and the item count is unchanged.
- [ ] e2e: `IN` 50 into Zone A → balance 50 and a corresponding `Movement` row exists.
- [ ] e2e: `OUT` 20 → balance 30; `TRANSFER` 10 A→B → A=20, B=10, total unchanged.
- [ ] e2e: `OUT` 10 against 5 on hand → **400** *and* a re-read of the balance still returns 5 (proves the transaction rolled back).
- [ ] e2e concurrency: fire two simultaneous `OUT` requests for the full available quantity — exactly one succeeds and the balance never goes negative.
- [ ] e2e: an item at 12 with `reorderAt` 10 appears in `/api/reports/low-stock` after an `OUT` of 5; an item at 40 does not.
- [ ] e2e: `GET /api/movements` returns actor email, item, type, qty and timestamp; filtering by `itemId` and by `from`/`to` returns only matching rows.
- [ ] e2e: `GET /api/admin/settings` returns masked values with configured status for `postgresql` and `minio` and is **403** for clerks; `PATCH` persists a value readable back through `resolveConfig`.
- [ ] Playwright smoke: the app root renders "StockRoom" (unauthenticated, after the redirect to `/login`).
- [ ] Playwright: login as clerk → item list and movement entry visible, manage/report/log nav absent; login as manager → all views reachable.
- [ ] Playwright: deep-link `/movements?itemId=…` directly and confirm the filter is applied from the URL; reload a deep route to confirm nginx `try_files` does not 404.
- [ ] Boot check: `docker compose up` → `GET /api/health/deep` returns `db: up` and both demo accounts (`manager@demo`, `clerk@demo` / `Demo1234!`) log in; rerunning the seed does not duplicate rows or inflate balances.

## Open questions
- **Role naming collision.** The pipeline auth context supplies `full_auth` with roles `admin, user`, but the spec's source-of-truth enum is `Role { clerk manager }`. These tasks keep the spec's `clerk`/`manager` enum and treat `manager` as the admin-equivalent role for the `/admin` route group and `/admin/settings`. Confirm before db_agent runs — a late rename touches schema, guards, seeds, and every e2e assertion.
- **Signup role vs. full_auth default.** The generic full_auth rule says the first signup becomes ADMIN; the spec explicitly requires signup to always create a `clerk` so the "clerk cannot manage the catalog" scenario cannot be bypassed, with the seeded `manager@demo` as the only manager. Spec wins here — flagging the deviation.
- **`minio` is provisioned but unused by the spec.** `<spec_deployments>` lists `postgresql, minio`, yet the spec describes no object storage, uploads, or attachments. Admin settings surfaces a `minio` credential section, but no feature consumes it. Confirm whether minio should be dropped or a spec'd use exists.
- **Angular version drift.** The spec calls for Angular 22 + `@angular/material@^22`; the scaffolded workspace is on `^19.2.0` with SSR. Confirm whether ui_agent should upgrade the workspace to 22 or build on the scaffolded version (the standalone/route/`dist/<project>/browser` assumptions hold either way).
- **Scaffold is tRPC-based.** `src/trpc/*`, `users.router.ts`, and `ngx-trpc` conflict with the spec's REST surface; these tasks assume they are deleted. Confirm nothing downstream (`surface.json`, Colossus deploy) depends on the `/trpc` endpoint.
- **Prisma major version.** The scaffold pins `prisma@^7`/`@prisma/client@^7`; the spec mandates `^6`. Confirm the downgrade is acceptable to the deploy tooling.
- **Movement corrections.** The spec defines no edit/void path for a mistaken movement, and the audit log is required to stay referentially intact. Assume movements are append-only unless told otherwise.
- **Pagination contract.** `GET /api/movements` is "paginated" but the spec fixes neither page size nor the response envelope (`{data, total, page}` vs. headers). Backend_agent should pick one and service_agent must mirror it.
