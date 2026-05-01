FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ bash eza
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache git bash python3 make g++ curl \
  && corepack enable

COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "./node_modules/tsx/dist/cli.mjs", "src/server.ts"]
