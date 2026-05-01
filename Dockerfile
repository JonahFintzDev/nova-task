# -------------------------------------------------- dashboard-builder --------------------------------------------------
FROM node:22-bookworm AS dashboard-builder
WORKDIR /build/dashboard
COPY dashboard/package.json dashboard/package-lock.json* ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# -------------------------------------------------- api-builder --------------------------------------------------
FROM node:24-bookworm AS api-builder
WORKDIR /build/api
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY api/package.json api/package-lock.json* ./
RUN npm ci
COPY api/prisma ./prisma
COPY api/prisma.config.ts ./
COPY api/tsconfig.json ./
COPY api/src ./src
# prisma.config.ts requires DATABASE_URL at config load; generate does not connect to the DB
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
RUN npx prisma generate && npm run build

# -------------------------------------------------- runtime --------------------------------------------------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOME=/config
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY api/package.json api/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=api-builder /build/api/build ./build
COPY --from=api-builder /build/api/prisma ./prisma
COPY --from=api-builder /build/api/prisma.config.ts ./
COPY --from=api-builder /build/api/src/generated ./src/generated
COPY --from=dashboard-builder /build/dashboard/dist ./dashboard/dist
COPY api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
