# ---------- build ----------
FROM node:22-slim AS builder
WORKDIR /app

# A syntactically valid placeholder: `prisma generate` parses the datasource URL
# but never connects, so no database is needed at image-build time.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev --legacy-peer-deps

COPY . .
RUN npx prisma generate
# `incremental: true` means a stale tsbuildinfo would make tsc emit nothing while
# still exiting 0; removing it forces a full emit every build.
RUN rm -f tsconfig.build.tsbuildinfo && npm run build \
    && test -f dist/main.js \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

# ---------- runtime ----------
FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Dev dependencies are still needed at runtime: the entrypoint runs `prisma
# migrate deploy` and `prisma db seed`, and the seed is TypeScript executed by
# ts-node. Trimming to --omit=dev would break the first boot.
RUN npm ci --include=dev --legacy-peer-deps && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
# `.prisma` holds the generated client plus the query-engine binary; `@prisma/client`
# is only the thin wrapper. `npm ci` installs the wrapper but never the generated
# output, so both must be copied from the builder stage.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

# Migrations run before the app binds a port. A failed migration exits non-zero so
# Kubernetes never routes traffic to a pod with a schema it cannot serve. The seed
# is idempotent, so re-running it on every restart is safe.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
