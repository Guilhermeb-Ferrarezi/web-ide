# Web IDE

Self-hosted IDE estilo VS Code Online — clona seus repos do GitHub para a VPS e permite editar/commitar pelo navegador.

Plano completo: ver [PLAN.md](../PLAN.md).

## Stack

- **api/** — Bun + Fastify + TypeScript (simple-git, node-pty, chokidar, Octokit)
- **web/** — Bun + Vite + React + Tailwind + shadcn/ui + Radix + Axios + Monaco + xterm.js
- **Infra** — Dockerfile separado, `docker-compose.yml` na raiz

## Desenvolvimento local (sem Docker)

```bash
# 1. Configurar env da api
cp api/.env.example api/.env   # preencher GITHUB_CLIENT_ID/SECRET
cp web/.env.example web/.env

# 2. Instalar dependências de tudo
bun run install:all

# 3. Subir api + web juntos
bun run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000
- Workspaces locais em `api/.workspaces/` (configurável via `WORKSPACES_ROOT`)
- Para liberar terminal irrestrito a usuários específicos, preencha `TERMINAL_SUPERUSERS` em `api/.env` com `login`, `githubUserId` ou `userId` separados por vírgula

Para rodar separado:

```bash
bun run dev:api   # só a api
bun run dev:web   # só o front
```

## Produção (Docker)

```bash
cp api/.env.example api/.env
bun run docker:up
```

- Web: http://localhost:8080
- API: http://localhost:3000
- Workspaces persistidos em volume Docker `workspace_data` → `/data/workspaces`
- O Codex usa `CODEX_HOME=/root/.codex` e monta `~/.codex` do host como leitura no container da API; garanta que `auth.json` exista nesse diretório antes de subir.

## Outros scripts

```bash
bun run test         # testes da api + web
bun run typecheck    # tsc nos dois projetos
bun run build        # build de produção do web
```
