FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ bash
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1.3.11-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache git bash python3 make g++ curl nodejs npm eza \
  && npm install -g @openai/codex

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "src/server.ts"]
