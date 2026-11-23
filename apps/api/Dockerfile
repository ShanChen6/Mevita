# API Mevita (NestJS + Socket.io) — build từ thư mục gốc monorepo:
#   docker build -f apps/api/Dockerfile -t mevita-api .
# Khi khởi động: chạy migration (prisma migrate deploy) rồi mới mở cổng.

# Đổi nguồn ảnh khi Docker Hub giới hạn: --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-slim
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
# OpenSSL cho engine migrate của Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* && corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @mevita/api... --ignore-scripts
COPY apps/api apps/api
RUN pnpm --filter @mevita/api exec prisma generate && pnpm --filter @mevita/api build

FROM base AS runtime
ENV NODE_ENV=production PORT=4000 PATH=/app/apps/api/node_modules/.bin:$PATH
# Giữ cả devDependencies (prisma CLI, tsx) để chạy migrate / seed ngay trong container
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY apps/api/package.json apps/api/prisma.config.ts apps/api/tsconfig.json /app/apps/api/
COPY apps/api/prisma /app/apps/api/prisma
# Mã nguồn TS cho lệnh seed (chạy bằng tsx) + Prisma client đã sinh
COPY apps/api/src /app/apps/api/src
COPY --from=build /app/apps/api/src/generated /app/apps/api/src/generated
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "prisma migrate deploy && node dist/main.js"]
