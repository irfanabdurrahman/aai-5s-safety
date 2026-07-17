# ---- deps ----
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# DATABASE_URL dummy hanya untuk build (halaman dirender saat runtime)
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV SESSION_SECRET="build-only-secret"
RUN npm run build

# ---- runner ----
FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update -qq && apt-get install -y -qq openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads

# Prisma CLI untuk migrate deploy saat start
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/generated ./src/generated

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
