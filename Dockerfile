# syntax=docker/dockerfile:1
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ARG APP_RELEASE_ID
RUN test -n "$APP_RELEASE_ID" && echo "$APP_RELEASE_ID" | grep -Eq '^release-[0-9]{8}-[0-9]{6}$'
ENV APP_RELEASE_ID=$APP_RELEASE_ID \
    APP_SCHEMA_MARKER=20260719173000_login_throttle
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate \
  && DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
     SESSION_SECRET="build-only-not-a-production-secret" \
     npm run build

FROM node:22-slim AS runner
WORKDIR /app
ARG APP_RELEASE_ID
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install --global prisma@7.8.0 \
  && mkdir -p /app/node_modules \
  && ln -s /usr/local/lib/node_modules/prisma /app/node_modules/prisma \
  && npm cache clean --force

ENV NODE_ENV=production \
    APP_RELEASE_ID=$APP_RELEASE_ID \
    APP_SCHEMA_MARKER=20260719173000_login_throttle \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

COPY --from=build --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=node:node /app/prisma/migrations ./prisma/migrations
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# Schema migration is a separate one-shot release step using a short-lived
# migration credential. The long-running application receives only DML rights.
CMD ["node", "server.js"]
