# Test Specification

> ⚠️ **WARNING — `.pipeline/surface.json` is stale and was NOT used as the endpoint source of truth.**
> The committed `surface.json` is the untouched scaffold manifest (`GET /health`, `GET /trpc/users.findAll`,
> `GET /trpc/users.findById`; components `app-root` / `app-home`; test IDs `home-title`, `users-list`, …).
> It describes the tRPC template that `tasks.md` explicitly instructs the backend agent to **delete**.
> None of its routes, components, or test IDs exist in the StockRoom design.
> The API surface below is therefore derived from `requirements/spec.md` (absent from the worktree — the
> `<spec>` input was used) cross-checked against the Surface contract table in `.pipeline/tasks.md`.
> **Action required:** `surface.json` must be regenerated once the REST routes and Angular components land,
> otherwise downstream Playwright generation will target selectors that do not exist.
> `.colossus-acceptance.json` is likewise scaffold-shaped (`ready_testid: "app-ready"`, empty `expect_text`)
> and needs `expect_text: ["StockRoom"]` before the render gate is meaningful.

## Coverage summary
- Total cases: **235** (162 API + 56 UI/journey + 17 data integrity)
- API endpoints covered: **19 / 19** (19 real StockRoom endpoints; the 3 routes actually listed in the stale
  `surface.json` are covered only by removal assertions — see *Out of scope*)
- User journeys covered: **15**

### Test fixtures assumed by every case
| Fixture | Value |
|---|---|
| Manager account | `manager@demo` / `Demo1234!` (role `manager`, seeded — the only manager) |
| Clerk account | `clerk@demo` / `Demo1234!` (role `clerk`, seeded) |
| Locations | `Zone A` (zone `A`), `Zone B` (zone `B`), `Zone C` (zone `C`) |
| Catalog | 8 seeded items; ≥1 at/below `reorderAt`; ≥1 stocked in two locations |
| Base URL | API `http://localhost:3000/api`, SPA `http://localhost:4200` (or nginx `:80` in compose) |

**Isolation rule:** API suites must create their own items (`sku` prefixed `TEST-<uuid>`) rather than mutating
seeded rows, so a re-run of `prisma db seed` between runs cannot make assertions flap. Cases that assert on
seeded data are marked *(seed-dependent)*.

---

## API tests

### `GET /api/health`
- **Happy path**:
  - `[A-001]` `GET /api/health` with **no** `Authorization` header → `200`, body `{status:'ok'}`. Proves `@Public()` opts out of the global `JwtAuthGuard`.
  - `[A-002]` Same request **with** a valid manager token → `200` (public routes must not reject bearer tokens).
- **Validation failures**: n/a — no inputs.
- **Auth failures**: none expected; `[A-003]` with a syntactically invalid token `Authorization: Bearer garbage` → still `200`, not `401`.
- **Idempotency / edge cases**: `[A-004]` 5 sequential calls all return `200` with identical body shape; response contains no DB round-trip latency dependency (must succeed even if Postgres is stopped).

### `GET /api/health/deep`
- **Happy path**: `[A-005]` unauthenticated `GET` with Postgres up → `200`, body `{status:'ok', db:'up'}` (asserts both keys explicitly, not just the status code).
- **Validation failures**: n/a.
- **Auth failures**: `[A-006]` no token → `200`, never `401` (route is `@Public()`).
- **Idempotency / edge cases**:
  - `[A-007]` With the `db` container stopped/`DATABASE_URL` pointed at a dead port → `503`, body does **not** claim `db:'up'`.
  - `[A-008]` Boot check: immediately after `docker compose up` reports `db` healthy, `/api/health/deep` returns `db:'up'` within a 60s poll window (migrate+seed must have completed).

### `POST /api/auth/login`
- **Happy path**:
  - `[A-009]` `{email:'manager@demo', password:'Demo1234!'}` → `200`, body `{token:<non-empty string>, user:{id, email:'manager@demo', role:'manager'}}`; `passwordHash` MUST be absent from the response.
  - `[A-010]` `{email:'clerk@demo', password:'Demo1234!'}` → `200`, `user.role === 'clerk'`.
  - `[A-011]` Decoded JWT payload contains `sub`, `email`, `role`, and an `exp` ≈ `iat + 24h` (±60s).
- **Validation failures** (all `400` with a `{message}` body):
  - `[A-012]` missing `password` → `400`.
  - `[A-013]` missing `email` → `400`.
  - `[A-014]` `email:'not-an-email'` → `400` (`@IsEmail`).
  - `[A-015]` extra property `{email, password, role:'manager'}` → the extra key is stripped by `whitelist:true` and the issued token's `role` is still `manager`'s real DB role — a clerk cannot self-elevate via the login body.
- **Auth failures**:
  - `[A-016]` correct email, wrong password `'Wrong1234!'` → `401`, and the message must not distinguish "no such user" from "bad password".
  - `[A-017]` unknown email `'nobody@demo'` → `401` with the *same* message/status as `[A-016]`.
- **Idempotency / edge cases**: `[A-018]` two logins in a row both succeed and issue independently valid tokens (no single-session invalidation). `[A-019]` email match is exact — `MANAGER@demo` behaves per the implementation's documented casing rule and is asserted consistently.

### `POST /api/auth/signup`
- **Happy path**: `[A-020]` `{email:'new-<uuid>@demo', password:'Demo1234!'}` → `201`, body user has `role === 'clerk'`; a subsequent login with those credentials succeeds.
- **Validation failures**:
  - `[A-021]` duplicate email (`clerk@demo`) → `400`, and the `User` row count is unchanged.
  - `[A-022]` password shorter than the DTO minimum (e.g. `'x'`) → `400`.
  - `[A-023]` malformed email → `400`.
- **Auth failures**: `[A-024]` no token required — unauthenticated signup returns `201`, never `401`.
- **Idempotency / edge cases** — *privilege-escalation guard, the highest-value case here*:
  - `[A-025]` `{email, password, role:'manager'}` → created user's `role` is **`clerk`**, not `manager`. `whitelist:true` strips `role` and the service assigns `clerk` unconditionally.
  - `[A-026]` After signup, that account gets `403` on `POST /api/items` — confirms the escalation attempt had no effect end-to-end.
  - `[A-027]` The seeded `manager@demo` remains the only `role='manager'` row after all signup cases run.

### `GET /api/auth/me`
- **Happy path**: `[A-028]` with the manager token → `200`, `{id, email:'manager@demo', role:'manager'}`, no `passwordHash`.
- **Validation failures**: n/a.
- **Auth failures**:
  - `[A-029]` no `Authorization` header → `401`.
  - `[A-030]` `Bearer <malformed>` → `401`.
  - `[A-031]` token signed with the wrong `JWT_SECRET` → `401`.
  - `[A-032]` expired token (`exp` in the past) → `401`.
- **Idempotency / edge cases**: `[A-033]` token whose `sub` refers to a deleted user → `401`/`403`, never a `500` (strategy must handle a missing user record).

### `GET /api/items`
- **Happy path**:
  - `[A-034]` clerk token → `200`, array; every element carries a numeric `totalQty`.
  - `[A-035]` manager token → `200` (both roles may read).
  - `[A-036]` For an item with `StockLevel` rows `Zone A: 20`, `Zone B: 10`, the returned `totalQty === 30` — derived, never a stored column.
  - `[A-037]` An item with **no** `StockLevel` rows returns `totalQty === 0` (not `null`/absent).
  - `[A-038]` `?q=<substring of name>` returns only matching items; `?q=<substring of sku>` likewise; `?q=zzz-no-match` → empty array + `200`.
  - `[A-039]` `?lowStock=true` returns only items where `totalQty <= reorderAt`.
- **Validation failures**: `[A-040]` `?lowStock=notabool` → `400` or is safely coerced/ignored — must not `500`.
- **Auth failures**: `[A-041]` no token → `401`.
- **Idempotency / edge cases**: `[A-042]` repeated GETs are side-effect free — `totalQty` for a fixture item is identical across two calls with no intervening movement.

### `GET /api/items/:id`
- **Happy path**:
  - `[A-043]` clerk token, seeded item stocked in two locations → `200` with `stockLevels: [{location:{id,name,zone}, qty}, …]` of length 2, plus the scalar item fields (`sku`, `name`, `unit`, `reorderAt`, `description`). *(seed-dependent)*
  - `[A-044]` `sum(stockLevels[].qty)` equals the `totalQty` the same item reports in `GET /api/items`.
- **Validation failures**: `[A-045]` unknown but well-formed id → `404`. `[A-046]` malformed id (`'!!!'`) → `400` or `404`, never `500`.
- **Auth failures**: `[A-047]` no token → `401`.
- **Idempotency / edge cases**: `[A-048]` item with zero stock rows → `200` with `stockLevels: []`.

### `POST /api/items`
- **Happy path**: `[A-049]` manager token, `{sku:'TEST-A1', name:'Widget', unit:'ea', reorderAt:10, description:'d'}` → `201` with an `id`; the item is then visible in `GET /api/items` with `totalQty: 0`.
- **Validation failures** (all `400` + `{message}`):
  - `[A-050]` **duplicate `sku`** → `400`, message `'SKU already exists'`, **and** the total item count is unchanged before/after (Prisma `P2002` mapped, not leaked as `500`).
  - `[A-051]` missing `sku` → `400`. `[A-052]` missing `name` → `400`.
  - `[A-053]` `reorderAt: -1` → `400`. `[A-054]` `reorderAt: 'ten'` → `400`. `[A-055]` `reorderAt` omitted → `400` (or documented default, asserted either way).
  - `[A-056]` unknown property `{sku,name,unit,reorderAt, totalQty: 999}` → `totalQty` is stripped and the created item still reports `totalQty: 0`.
- **Auth failures**: `[A-057]` **clerk token → `403`**, and no item is created. `[A-058]` no token → `401` (401 must take precedence over 403).
- **Idempotency / edge cases**: `[A-059]` two concurrent `POST`s with the same `sku` → exactly one `201`, one `400`; exactly one row exists.

### `PATCH /api/items/:id`
- **Happy path**: `[A-060]` manager updates `{name:'Renamed', reorderAt:25}` → `200`; a re-read reflects both fields and leaves `sku` untouched.
- **Validation failures**: `[A-061]` patching `sku` to another item's `sku` → `400` `'SKU already exists'`. `[A-062]` `reorderAt: -5` → `400`. `[A-063]` empty body `{}` → `200` no-op or `400`, asserted consistently.
- **Auth failures**: `[A-064]` clerk → `403`. `[A-065]` no token → `401`.
- **Idempotency / edge cases**: `[A-066]` unknown id → `404`. `[A-067]` applying the same patch twice yields the same final state. `[A-068]` a patch never alters `StockLevel` rows — `totalQty` before == after.

### `DELETE /api/items/:id`
- **Happy path**: `[A-069]` manager deletes a freshly created item with **no** stock and **no** movements → `200`/`204`; it disappears from `GET /api/items`; a follow-up `GET /api/items/:id` → `404`.
- **Validation failures**:
  - `[A-070]` delete an item that has a non-zero `StockLevel` row → `400` with a referential-integrity message; the item still exists.
  - `[A-071]` delete an item referenced by a `Movement` (even with all balances now 0) → `400`; the audit row survives. This is the load-bearing "audit log stays referentially intact" case.
- **Auth failures**: `[A-072]` clerk → `403`. `[A-073]` no token → `401`.
- **Idempotency / edge cases**: `[A-074]` deleting an already-deleted id → `404`, not `500`.

### `GET /api/locations`
- **Happy path**: `[A-075]` **clerk** token → `200` with the three seeded zones — explicitly asserted because the movement form's location selects depend on clerk read access. `[A-076]` manager token → `200`, same payload shape `{id, name, zone}`.
- **Validation failures**: n/a.
- **Auth failures**: `[A-077]` no token → `401`.
- **Idempotency / edge cases**: `[A-078]` after a re-seed, `Zone A`/`Zone B`/`Zone C` appear exactly once each (upsert keyed on `name`).

### `POST /api/locations`
- **Happy path**: `[A-079]` manager `{name:'Zone T', zone:'T'}` → `201`; appears in `GET /api/locations`.
- **Validation failures**: `[A-080]` duplicate `name` (`'Zone A'`) → `400`, location count unchanged. `[A-081]` missing `name` → `400`. `[A-082]` missing `zone` → `400`.
- **Auth failures**: `[A-083]` clerk → `403`. `[A-084]` no token → `401`.
- **Idempotency / edge cases**: `[A-085]` a new location starts with no `StockLevel` rows and contributes `0` to every item's `totalQty`.

### `PATCH /api/locations/:id`
- **Happy path**: `[A-086]` manager renames a test location → `200`; re-read reflects it.
- **Validation failures**: `[A-087]` rename to an existing `name` → `400`. `[A-088]` unknown id → `404`.
- **Auth failures**: `[A-089]` clerk → `403`. `[A-090]` no token → `401`.
- **Idempotency / edge cases**: `[A-091]` renaming a location does not change any `StockLevel.qty` or reassign movement history.

### `DELETE /api/locations/:id`
- **Happy path**: `[A-092]` manager deletes an unreferenced location → `200`/`204`; gone from the list.
- **Validation failures**: `[A-093]` delete a location holding stock → `400`, still present. `[A-094]` delete a location referenced as a movement `fromLoc` **or** `toLoc` → `400` (both FK directions tested).
- **Auth failures**: `[A-095]` clerk → `403`. `[A-096]` no token → `401`.
- **Idempotency / edge cases**: `[A-097]` deleting an unknown id → `404`.

### `POST /api/movements`
- **Happy path** — the balance-arithmetic chain, run in order against one fixture item:
  - `[A-098]` **IN** `{type:'IN', itemId, toLocId:<Zone A>, qty:50}` → `201`; `GET /api/items/:id` shows `Zone A: 50`; a `Movement` row exists with `type:'IN'`, `qty:50`, `userId` = the caller.
  - `[A-099]` **OUT** `{type:'OUT', itemId, fromLocId:<Zone A>, qty:20}` → `201`; Zone A balance is now `30`.
  - `[A-100]` **TRANSFER** `{type:'TRANSFER', itemId, fromLocId:<Zone A>, toLocId:<Zone B>, qty:10}` → `201`; Zone A `20`, Zone B `10`, and `totalQty` is unchanged at `30`.
  - `[A-101]` A **clerk** may post all three types (`201`) — movement entry is not manager-gated.
  - `[A-102]` `IN` into a location with no existing `StockLevel` row creates it via upsert (`qty` = the moved amount), rather than `404`ing.
- **Validation failures** (all `400` + `{message}`; each asserts balances are untouched afterwards):
  - `[A-103]` `IN` **without** `toLocId` → `400`.
  - `[A-104]` `IN` **with** `fromLocId` supplied → `400` (IN forbids a source).
  - `[A-105]` `OUT` without `fromLocId` → `400`.
  - `[A-106]` `TRANSFER` missing `toLocId` → `400`; `[A-107]` `TRANSFER` missing `fromLocId` → `400`.
  - `[A-108]` `TRANSFER` with `fromLocId === toLocId` → `400`.
  - `[A-109]` `qty: 0` → `400`; `[A-110]` `qty: -5` → `400`; `[A-111]` `qty: 1.5` → `400` (`@IsInt`); `[A-112]` `qty:'50'` string → coerced by `transform:true` **or** `400`, asserted explicitly.
  - `[A-113]` `type:'ADJUST'` (not in the enum) → `400`.
  - `[A-114]` unknown `itemId` → `400`/`404`, never `500`; `[A-115]` unknown `fromLocId`/`toLocId` → `400`/`404`.
  - `[A-116]` **Insufficient stock — the rollback proof.** With 5 on hand at Zone A, `OUT` `qty:10` → `400` message `'Insufficient stock'`, **and a re-read of the balance still returns exactly 5**, **and no `Movement` row was written** (both halves of the transaction rolled back).
  - `[A-117]` `TRANSFER` exceeding source stock → `400`; the *destination* balance is also unchanged (the increment must not survive the rollback).
  - `[A-118]` `OUT` from a location where the item has no `StockLevel` row at all → `400` `'Insufficient stock'` (`updateMany` matches 0 rows), not a crash.
- **Auth failures**: `[A-119]` no token → `401`, no movement written.
- **Idempotency / edge cases**:
  - `[A-120]` **Concurrency — the guarded-`updateMany` proof.** With exactly `N` on hand, fire two simultaneous `OUT` requests of `qty: N`. Exactly one returns `201` and one returns `400`; the final balance is `0` and **never negative**; exactly one `Movement` row was written. Repeat ×5 to catch flakiness from a read-then-write implementation that passes serially.
  - `[A-121]` Two simultaneous **IN**s into the same never-before-stocked `(item, location)` pair both succeed and the final balance is the exact sum — proves the `P2002` upsert-race retry path.
  - `[A-122]` `OUT` for exactly the full available quantity (boundary `qty === qty_on_hand`) → `201`, balance `0` (the guard is `gte`, not `gt`).
  - `[A-123]` Every accepted movement stamps `userId` from the JWT, not from the request body — posting `{…, userId:'<other user id>'}` still records the authenticated caller.

### `GET /api/movements`
- **Happy path**:
  - `[A-124]` manager token → `200`; each row exposes **actor email**, item, `type`, `qty`, `fromLoc`/`toLoc`, and a `createdAt` timestamp (all five asserted per the spec's audit requirement).
  - `[A-125]` Rows are ordered `createdAt` **descending** — the movement created last in the fixture chain is first.
  - `[A-126]` `?itemId=<fixture item>` returns only rows for that item (assert every row, and that a known other-item movement is absent).
  - `[A-127]` `?type=TRANSFER` returns only `TRANSFER` rows.
  - `[A-128]` `?from=<ISO ts before the fixture chain>&to=<ISO ts after>` returns the fixture rows; narrowing `from` to *after* the chain returns `[]`.
  - `[A-129]` `?from` and `?to` are inclusive `gte`/`lte` boundaries — a row whose `createdAt` equals `from` exactly is included.
  - `[A-130]` Combined filters (`?itemId=…&type=OUT`) apply as AND, not OR.
  - `[A-131]` Pagination: `?page=1` and `?page=2` return disjoint row sets; the envelope shape (`{data,total,page}` vs bare array) is asserted against whatever backend_agent chose, and must match what `api.service.ts` parses. *(Open question in tasks.md — pin this in the first passing run.)*
- **Validation failures**: `[A-132]` `?type=BOGUS` → `400`. `[A-133]` `?from=not-a-date` → `400`. `[A-134]` `?page=0` / `?page=-1` → `400` or clamped to 1, asserted consistently.
- **Auth failures**: `[A-135]` **clerk token → `403`** (audit log is manager-only). `[A-136]` no token → `401`.
- **Idempotency / edge cases**: `[A-137]` a filter matching nothing returns `200` with an empty collection, not `404`.

### `GET /api/reports/low-stock`
- **Happy path**:
  - `[A-138]` manager token → `200`; every row is `{item, totalQty, reorderAt, shortfall}`.
  - `[A-139]` **Threshold behaviour.** Item at `totalQty:12`, `reorderAt:10` is absent; after an `OUT` of 5 (→ 7) it **appears**. A control item at `totalQty:40`, `reorderAt:10` never appears.
  - `[A-140]` Boundary: `totalQty === reorderAt` **is** included (predicate is `<=`, not `<`).
  - `[A-141]` `shortfall === reorderAt - totalQty` for every row, and rows are sorted by `shortfall` **descending**.
  - `[A-142]` `totalQty` sums across *all* locations — an item at `Zone A: 6` + `Zone B: 6` with `reorderAt: 10` is **not** low-stock (guards against a per-location-row bug).
  - `[A-143]` Non-empty on a fresh seeded boot. *(seed-dependent)*
- **Validation failures**: n/a — no inputs.
- **Auth failures**: `[A-144]` clerk → `403`. `[A-145]` no token → `401`.
- **Idempotency / edge cases**: `[A-146]` an item with zero stock rows (`totalQty: 0`, `reorderAt > 0`) appears with `shortfall === reorderAt`.

### `GET /api/admin/settings`
> ⚠️ Not in the product spec — added by `tasks.md` for the provisioned backing services. Covered because it is
> in the built surface; see *Out of scope* for the caveat.
- **Happy path**: `[A-147]` manager token → `200`; a section/entry exists for `postgresql` and for `minio`, each with a **masked** value and a boolean `configured` status.
- **Validation failures**: n/a.
- **Auth failures**: `[A-148]` clerk → `403`. `[A-149]` no token → `401`.
- **Idempotency / edge cases**: `[A-150]` **no response field contains a raw secret** — the returned value never equals the plaintext just written via `PATCH`, and never equals `process.env.DATABASE_URL`. `[A-151]` an unset key reports `configured: false`, as does one literally equal to `PLACEHOLDER_CONFIGURE_IN_SETTINGS`.

### `PATCH /api/admin/settings`
- **Happy path**: `[A-152]` manager writes `{MINIO_ACCESS_KEY:'abc123'}` → `200`; a follow-up `GET` shows that key `configured: true` with a masked value; `resolveConfig('MINIO_ACCESS_KEY')` resolves to `'abc123'`.
- **Validation failures**: `[A-153]` malformed body (non-object / wrong value type) → `400`. `[A-154]` an unknown key is rejected `400` or ignored, asserted consistently.
- **Auth failures**: `[A-155]` clerk → `403`. `[A-156]` no token → `401`.
- **Idempotency / edge cases**: `[A-157]` writing the same key twice upserts (one `SystemSetting` row, second value wins). `[A-158]` `resolveConfig` precedence — with a real env var set, env wins; when env is unset **or** equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, the `SystemSetting` row wins; when neither is set it returns `null`.

### Cross-cutting API cases
- `[A-159]` **Global 401 sweep.** Iterate every non-public route above with no `Authorization` header and assert `401` for each. This is the single case that proves `JwtAuthGuard` is registered as an `APP_GUARD` rather than sprinkled per-controller — a new unguarded controller must fail this test.
- `[A-160]` **Global prefix.** `GET /items` (no `/api`) → `404`; `GET /api/items` → `200`. Confirms `setGlobalPrefix('api')`.
- `[A-161]` **Removed scaffold routes.** `GET /trpc/users.findAll` and `GET /trpc/users.findById` → `404` (the tRPC stack was deleted, per `tasks.md`).
- `[A-162]` Error envelope consistency: `400`, `401`, and `403` responses all carry a `{message}` field the frontend interceptor can render inline.

---

## UI / journey tests

Run against the compose-served SPA. Selectors: prefer `data-testid`; the stale IDs in `surface.json`
(`home-title`, `users-list`, …) must **not** be used — new IDs are needed and `surface.json` regenerated.

### Journey: Unauthenticated smoke / brand marker
- **Steps**: Navigate to `/` with no stored token.
- **Expected outcomes**:
  - `[J-001]` Redirected to `/login`.
  - `[J-002]` The literal text **StockRoom** is visible on the rendered login view. *This is the oracle assertion — the brand must live on the unauthenticated page, not only in the authenticated shell.*
  - `[J-003]` `document.title === 'StockRoom'`.
  - `[J-004]` The acceptance `ready_testid` (`app-ready`, or its replacement) is present once the app has hydrated.
  - `[J-005]` None of the reject signatures render: no `home-title">Users<`, no stale `Loading...`, no `Failed to load users.`
- **Negative path**: `[J-006]` With the API container down, `/login` still renders "StockRoom" (a blank white page here is the silent-failure mode the spec's Risks section calls out).

### Journey: Clerk login → restricted navigation
- **Steps**: `/login` → type `clerk@demo` / `Demo1234!` → submit.
- **Expected outcomes**:
  - `[J-007]` URL becomes `/items`; the item table renders with columns sku, name, unit, reorderAt, totalQty.
  - `[J-008]` Nav shows Items and Movement entry (`/movements/new`).
  - `[J-009]` Nav does **not** show Locations, Movement log, Low-stock report, or Admin settings.
  - `[J-010]` Direct navigation to `/movements`, `/reports/low-stock`, `/locations`, `/items/new`, and `/admin/settings` each bounce back to `/items` (`roleGuard`), with no server data leaked in between.
- **Negative path**: `[J-011]` Wrong password → stays on `/login` with an inline error; no token is written to `localStorage`.

### Journey: Manager login → full navigation
- **Steps**: Log in as `manager@demo`.
- **Expected outcomes**:
  - `[J-012]` All nav entries render: Items, Locations, Movement entry, Movement log, Low-stock report, Admin settings.
  - `[J-013]` Each of `/items`, `/items/new`, `/locations`, `/locations/new`, `/movements/new`, `/movements`, `/reports/low-stock`, `/admin/settings` loads its own view without redirect.
- **Negative path**: `[J-014]` Navigating to a garbage URL `/nope` → redirected to `/items` (wildcard route).

### Journey: Signup as a new clerk
- **Steps**: `/signup` → unique email + `Demo1234!` → submit.
- **Expected outcomes**: `[J-015]` Account created and signed in (or routed to `/login` per the implementation), landing authenticated on `/items`; `[J-016]` the manager-only nav is absent — the new account is a clerk; `[J-017]` copy on the page states new accounts are clerks.
- **Negative path**: `[J-018]` Signing up with `clerk@demo` shows the `400` message inline; the user stays on `/signup`.

### Journey: Browse and filter the catalog
- **Steps**: As clerk, `/items` → type into the search box → toggle the low-stock filter.
- **Expected outcomes**:
  - `[J-019]` Typing a query updates the URL to `/items?q=<term>` and the table narrows to matches.
  - `[J-020]` Toggling low-stock sets `?lowStock=true`; rows at/below `reorderAt` are visually highlighted.
  - `[J-021]` **Reloading `/items?q=widget&lowStock=true` restores both controls from the URL** — filter state lives in query params, never component-only state.
- **Negative path**: `[J-022]` A query matching nothing shows an explicit empty state, not a spinner that never resolves.

### Journey: Item detail with per-location breakdown
- **Steps**: `/items` → click the seeded item stocked in two locations.
- **Expected outcomes**: `[J-023]` URL `/items/:id`; the per-location table lists Zone A and Zone B with their quantities, and the displayed quantities sum to the `totalQty` shown on the list row.
- **Negative path**: `[J-024]` `/items/<unknown-id>` shows a not-found state rather than a blank page or an uncaught error.

### Journey: Manager creates an item (duplicate SKU surfacing)
- **Steps**: `/items/new` → fill sku/name/unit/reorderAt → Save.
- **Expected outcomes**: `[J-025]` Redirect to the list (or detail); the new item appears with `totalQty` 0.
- **Negative path**: `[J-026]` Submitting an existing `sku` renders **`SKU already exists`** attached to the sku control; the user stays on the form with input preserved. `[J-027]` Client-side required-field validation blocks submit with empty sku/name.

### Journey: Manager edits and attempts to delete an item
- **Steps**: `/items/:id/edit` → change name and reorderAt → Save; then attempt delete on an item with stock.
- **Expected outcomes**: `[J-028]` The edit persists and is visible after a reload.
- **Negative path**: `[J-029]` Deleting an item that has stock or movement history surfaces the `400` message inline; the item remains in the list.

### Journey: Manager manages locations
- **Steps**: `/locations` → New → `{name:'Zone T', zone:'T'}` → Save → edit it → delete it.
- **Expected outcomes**: `[J-030]` Create, rename, and delete each reflect in the list without a manual refresh.
- **Negative path**: `[J-031]` Deleting `Zone A` (holds stock) surfaces the `400` inline and the row stays.

### Journey: Movement entry (type-driven conditional form)
- **Steps**: As clerk, `/movements/new` → pick item → select each type in turn.
- **Expected outcomes**:
  - `[J-032]` `IN` shows only the **To** location select (no From).
  - `[J-033]` `OUT` shows only the **From** select.
  - `[J-034]` `TRANSFER` shows **both**.
  - `[J-035]` A valid IN of 50 into Zone A submits successfully and the item's balance reflects it on the detail page.
  - `[J-036]` The location selects are populated for a clerk — proves `GET /api/locations` is clerk-readable in the running app.
- **Negative path**: `[J-037]` An OUT larger than the on-hand quantity renders **`Insufficient stock`** inline; the form stays populated and the balance on the detail page is unchanged. `[J-038]` `qty: 0` is blocked client-side.

### Journey: Movement log with URL-restored filters
- **Steps**: As manager, deep-link directly to `/movements?itemId=<id>` in a fresh tab.
- **Expected outcomes**:
  - `[J-039]` The item filter control is **pre-populated from the URL** and the table shows only that item's rows — no manual re-filtering.
  - `[J-040]` Each row shows timestamp, actor email, item, type, qty, and from/to.
  - `[J-041]` Changing a filter or page writes back to the query string; browser Back restores the previous filter set.
  - `[J-042]` `/movements?type=TRANSFER&from=<iso>&to=<iso>` restores all three controls.
- **Negative path**: `[J-043]` A filter combination with no results shows an explicit empty state.

### Journey: Low-stock report
- **Steps**: As manager, `/reports/low-stock`.
- **Expected outcomes**: `[J-044]` Table of item, totalQty, reorderAt, shortfall, sorted by shortfall descending; non-empty on a freshly seeded database.
- **Negative path**: `[J-045]` When nothing is below threshold, an explicit empty state renders (not a bare table header).

### Journey: Admin settings
- **Steps**: As manager, `/admin/settings`.
- **Expected outcomes**: `[J-046]` One section each for `postgresql` and `minio` with configured/unconfigured badges; `[J-047]` a banner listing unset services reads "The following need credentials to activate: …"; `[J-048]` saving a credential flips that service's badge to configured; `[J-049]` no plaintext secret is rendered in the DOM after save.
- **Negative path**: `[J-050]` A clerk navigating to `/admin/settings` is redirected to `/items`.

### Journey: Session lifecycle — persistence, expiry, logout
- **Steps**: Log in as manager → reload → clear/corrupt the stored token → trigger an API call → click Logout.
- **Expected outcomes**:
  - `[J-051]` After a full page reload the session survives (user restored from `localStorage`) and the manager nav still renders.
  - `[J-052]` With an expired/invalid token, the next API call's `401` routes the app to `/login` and clears stored auth state.
  - `[J-053]` Logout clears the token and returns to `/login`; pressing Back does not restore an authenticated view.
- **Negative path**: `[J-054]` With no token, deep-linking `/items/:id/edit` redirects to `/login`, not a partial render.

### Journey: SPA deep-link refresh (nginx `try_files`)
- **Steps**: In the compose-served frontend, navigate to `/movements?itemId=…` then press **hard reload**; repeat for `/items/:id` and `/reports/low-stock`.
- **Expected outcomes**: `[J-055]` Each returns `200` with the app shell and the correct view — not a `404` from nginx.
- **Negative path**: `[J-056]` The nginx root actually contains the built app — `/` returns HTML referencing the Angular bundles, not an empty-directory `200` (guards the `dist/frontend` vs `dist/frontend/browser` silent failure).

---

## Data integrity tests

Invariants asserted directly against Postgres (or via re-read) after each mutation.

- `[D-001]` **No negative balances, ever.** After every movement case above — including all failure and concurrency cases — `SELECT MIN(qty) FROM "StockLevel"` is `>= 0`.
- `[D-002]` **Conservation under TRANSFER.** `SUM(qty)` for an item across all locations is identical before and after a `TRANSFER`.
- `[D-003]` **IN raises the total by exactly `qty`;** `OUT` lowers it by exactly `qty`.
- `[D-004]` **Failed movements write nothing.** After a `400` (insufficient stock, bad shape, unknown FK), the `Movement` row count and every affected `StockLevel.qty` are byte-identical to their pre-request values.
- `[D-005]` **One row per `(itemId, locationId)`** — the `@@unique` constraint holds even after the concurrent-IN race `[A-121]`; a duplicate-pair insert is rejected at the DB level.
- `[D-006]` **Every `Movement` has a valid `userId`** resolving to an existing `User`, and it matches the JWT subject of the request that created it.
- `[D-007]` **Movement shape matches its type:** `IN` → `fromLocId IS NULL AND toLocId IS NOT NULL`; `OUT` → `toLocId IS NULL AND fromLocId IS NOT NULL`; `TRANSFER` → both non-null and unequal. Asserted as a table-wide query, so no code path can write a malformed row.
- `[D-008]` **`Movement.qty > 0`** for every row.
- `[D-009]` **Referential integrity of the audit log:** every `Movement.itemId`, `fromLocId`, `toLocId` resolves to a live row — no orphans, because deletes are blocked at `400`.
- `[D-010]` **`totalQty` is never persisted on `Item`** — the `Item` table has no `totalQty`/`onHand` column; the value is always derived.
- `[D-011]` **Seed idempotency.** Running `prisma db seed` twice (simulating a container restart) leaves `User`, `Item`, `Location`, `StockLevel`, and `Movement` counts unchanged and **does not inflate any `StockLevel.qty`**. This is the highest-risk data case — the compose entrypoint reruns the seed on every boot.
- `[D-012]` **Unique constraints enforced at the DB level:** `User.email`, `Item.sku`, `Location.name` each reject a duplicate insert issued directly against Postgres, not only via the API.
- `[D-013]` **Passwords are hashed:** no `User.passwordHash` equals `'Demo1234!'`, and each is a bcrypt-format string.
- `[D-014]` **Exactly one manager** (`role='manager'`) exists after the full suite, including all signup cases — signup can never create a manager.
- `[D-015]` **Named relations resolve:** a `Movement` joined to both `fromLoc` and `toLoc` returns two *distinct* locations for a TRANSFER (proves the two FKs to `Location` are wired to separate named relations, not aliased to one).
- `[D-016]` **`createdAt` is monotonic and server-assigned:** a movement's `createdAt` is within a few seconds of the request, and a client-supplied `createdAt` in the body is ignored.
- `[D-017]` **Migrations are reproducible:** `prisma migrate deploy` against an empty database produces a schema on which the whole e2e suite passes (no drift between committed migrations and `schema.prisma`).

---

## Out of scope

- **The `surface.json` route list itself.** `GET /health` (unprefixed), `/trpc/users.findAll`, `/trpc/users.findById`, and the `app-home` / `users-list` / `home-title` test IDs are scaffold leftovers slated for deletion by `tasks.md`. They are covered only by the negative assertions `[A-160]`/`[A-161]` and `[J-005]`. **`surface.json` must be regenerated** before it is trusted by any downstream agent.
- **`minio` functionality.** It is provisioned and appears in admin settings, but the spec describes no uploads, attachments, or object storage. Only the settings-surface cases (`[A-147]`–`[A-158]`, `[J-046]`–`[J-049]`) are tested; there is no feature to exercise. Flagged as an open question in `tasks.md`.
- **Movement corrections / voids.** The spec defines no edit or reversal path and requires an append-only audit log. No `PATCH`/`DELETE /api/movements` cases exist — if such a route appears, it is an unspecified feature and should be treated as a defect.
- **Token refresh / revocation.** The spec fixes a 24h `localStorage` JWT with no refresh endpoint and no server-side session store. Logout-invalidates-token-server-side is explicitly *not* asserted; `[A-018]` documents that prior tokens remain valid.
- **Password reset, email verification, account deletion, profile editing.** Not in the spec.
- **Rate limiting / brute-force lockout.** The spec is silent; `[A-016]`/`[A-017]` assert only that failures are `401` and non-enumerable.
- **Exact pagination envelope for `GET /api/movements`.** `tasks.md` flags page size and response shape as an unresolved decision. `[A-131]` asserts *internal consistency* between the API and `api.service.ts` rather than a specific shape; tighten it once backend_agent commits to one.
- **Angular version.** The spec says 22, the scaffold is 19. No case asserts a framework version — every UI case is written against behaviour that holds on both.
- **Email casing semantics on login** (`[A-019]`) — the spec does not state whether lookup is case-insensitive; the case asserts consistency with the implementation rather than a specific rule.
- **Visual/CSS regression, responsive layout, accessibility audits, i18n, performance/load beyond the two-request concurrency check.** Not described in the spec.
- **`.github/workflows/colossus-deploy.yml`** — marked managed by Colossus and explicitly out of bounds; no CI-behaviour cases.
