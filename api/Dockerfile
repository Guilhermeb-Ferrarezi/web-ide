FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache git python3 make g++ bash

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "./node_modules/tsx/dist/cli.mjs", "src/server.ts"]
