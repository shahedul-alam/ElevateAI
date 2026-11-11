# Build context is the repo root (bun workspaces): docker build -f server/Dockerfile .
FROM oven/bun:1.4.4
WORKDIR /app
COPY package.json bun.lock ./
COPY client/package.json client/
COPY server/package.json server/
RUN bun install --frozen-lockfile
COPY server server
WORKDIR /app/server
# Prisma config loads env at generate time; this dummy is build-only and not kept at runtime.
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x bun run db:generate
ENV NODE_ENV=production
USER bun
EXPOSE 4000
CMD ["bun", "src/index.ts"]
