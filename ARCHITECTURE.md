# Architecture

## Stack

Requested stack: **enterprise** (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL).

This platform-fixed stack was scaffolded fresh — the project directory contained
no prior `frontend/` or `backend/` code before this run.

| Platform | Status | Location |
|---|---|---|
| enterprise | ✅ newly scaffolded | `frontend/` (Angular SPA), `backend/` (NestJS API) |

## Layout

- `frontend/` — Angular 19 standalone app, tRPC client wired via `TRPC_CLIENT` injection
  token (`frontend/src/app/app.config.ts`), root component at
  `frontend/src/app/app.component.ts`.
- `backend/` — NestJS API. tRPC routers live under `backend/src/*/*.router.ts`
  (e.g. `backend/src/users/users.router.ts`), composed by
  `backend/src/trpc/trpc.router.ts`. REST health check at
  `backend/src/health/health.controller.ts` (`GET /health`).
- `backend/prisma/schema.prisma` — Prisma schema and seed (`backend/prisma/seed.ts`).
- `.pipeline/surface.json` — generated manifest of routes, components, and
  `data-testid` values; the contract used by the test_spec and Playwright agents.
- `.colossus-acceptance.json` — generation-side acceptance contract read by the
  post-deploy render gate.
- `colossus.yaml` — build manifest consumed by deploy agents (framework, output
  dir, ports). Regenerated on every scaffolder run.

## Next steps for the developer implementing StockRoom

The plan calls for a full StockRoom domain (auth, items, locations, movements,
reports) to be built on top of this scaffold. To continue:

1. Copy environment files if present: `backend/.env.template` → `backend/.env`
   (none were present in this template at scaffold time — create `backend/.env`
   with `DATABASE_URL` and `JWT_SECRET` per the plan's `docker-compose.yml`).
2. Extend `backend/prisma/schema.prisma` with the StockRoom models
   (`User`, `Item`, `Location`, `StockLevel`, `Movement`) and run
   `npx prisma migrate dev --name init` inside `backend/`.
3. Run `npx prisma db seed` (wire `backend/prisma/seed.ts`) after the schema
   migration to populate demo users, locations, items, and stock levels.
4. `npm install` in both `frontend/` and `backend/` — keep
   `frontend/package.json` deps/devDeps verbatim from the template unless the
   plan genuinely requires a new package (adding one forces a full `npm install`
   instead of the prebaked Docker seed).
5. `docker compose up` to bring up Postgres + backend + frontend locally per
   the plan's `docker-compose.yml`.
6. Update `.pipeline/surface.json` as new routes/components/test IDs are added
   so downstream test generation stays in sync.
7. Fill in `.colossus-acceptance.json`'s `expect_text` with real front-page
   content once the login/shell views are built.

## Template source

- `enterprise` copied from `/app/scaffold-templates/template-enterprise/`.
