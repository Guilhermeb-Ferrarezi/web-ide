# Web IDE Self-Hosted — Plano de Implementação

## Stack

- **Runtime/Tooling:** Bun (package manager + runtime + test runner)
- **Frontend:** React + Vite + Vitest + Tailwind CSS + shadcn/ui + Radix UI + Axios
- **Backend:** Bun + Fastify + TypeScript (sem build — `bun src/server.ts` direto)
- **Git ops:** simple-git
- **Terminal:** node-pty + xterm.js + @fastify/websocket
- **GitHub:** Octokit (OAuth + API)
- **File watching:** chokidar → WebSocket
- **Infra:** Dockerfile separado para `api/` e `web/` + execução local sem Docker (`bun run dev` na raiz)
- **Sessão:** `@fastify/session` em memória (dev). Em produção real, registrar `connect-redis`.

---

## Estrutura de Pastas

### `api/`

```
api/
├── src/
│   ├── server.ts                    # Entry point, registra plugins e rotas
│   ├── config.ts                    # Variáveis de ambiente centralizadas (validação Zod no boot)
│   ├── plugins/
│   │   ├── cors.ts
│   │   ├── cookie.ts
│   │   ├── session.ts
│   │   ├── websocket.ts
│   │   └── static.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts       # GET /auth/github, GET /auth/github/callback, POST /auth/logout
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts
│   │   ├── repos/
│   │   │   ├── repos.routes.ts      # GET /repos, POST /repos/clone, GET /repos/local
│   │   │   ├── repos.controller.ts
│   │   │   └── repos.service.ts
│   │   ├── fs/
│   │   │   ├── fs.routes.ts         # GET /fs/tree, GET /fs/file, PUT /fs/file, DELETE /fs/file, POST /fs/upload
│   │   │   ├── fs.controller.ts
│   │   │   └── fs.service.ts
│   │   ├── git/
│   │   │   ├── git.routes.ts        # GET /git/status, GET /git/diff, POST /git/add, POST /git/commit, POST /git/push, POST /git/pull
│   │   │   ├── git.controller.ts
│   │   │   └── git.service.ts
│   │   ├── terminal/
│   │   │   ├── terminal.routes.ts   # WS /terminal
│   │   │   └── terminal.service.ts  # node-pty spawn + pipe bidirecional
│   │   └── watcher/
│   │       ├── watcher.routes.ts    # WS /watcher
│   │       └── watcher.service.ts   # chokidar watch + emissão de eventos
│   ├── middlewares/
│   │   ├── auth.middleware.ts       # preHandler — valida sessão/JWT
│   │   └── workspace.middleware.ts  # Resolve e valida workspacePath por request
│   ├── utils/
│   │   ├── path.utils.ts            # Sanitização e resolução segura de paths
│   │   └── octokit.ts               # Factory do cliente Octokit autenticado
│   └── types/
│       ├── fastify.d.ts             # Augmentação dos tipos do Fastify
│       └── index.ts
├── Dockerfile
├── tsconfig.json
├── package.json
└── .env.example
```

### `web/`

```
web/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts                # Instância Axios com baseURL e interceptors
│   │   ├── auth.ts
│   │   ├── repos.ts
│   │   ├── fs.ts
│   │   └── git.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useFileTree.ts
│   │   ├── useEditor.ts
│   │   ├── useGitStatus.ts
│   │   ├── useTerminal.ts
│   │   └── useWatcher.ts
│   ├── stores/
│   │   ├── workspaceStore.ts        # Zustand: repo ativo, userId, workspacePath
│   │   └── editorStore.ts           # Zustand: tabs, arquivo ativo, unsaved changes
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── ReposPage.tsx
│   │   └── IDEPage.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx         # ResizablePanelGroup raiz
│   │   │   ├── Sidebar.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── file-tree/
│   │   │   ├── FileTree.tsx
│   │   │   ├── FileTreeNode.tsx
│   │   │   └── FileTreeToolbar.tsx
│   │   ├── editor/
│   │   │   ├── EditorTabs.tsx
│   │   │   ├── EditorPane.tsx       # Monaco Editor wrapper
│   │   │   └── EditorPlaceholder.tsx
│   │   ├── git/
│   │   │   ├── GitPanel.tsx
│   │   │   ├── GitFileList.tsx
│   │   │   ├── GitDiffViewer.tsx    # MonacoDiffEditor
│   │   │   └── GitCommitForm.tsx
│   │   ├── terminal/
│   │   │   ├── TerminalPane.tsx
│   │   │   └── TerminalToolbar.tsx
│   │   └── shared/
│   │       ├── FileIcon.tsx
│   │       └── ConfirmDialog.tsx
│   ├── lib/
│   │   └── utils.ts                 # cn() helper do shadcn
│   └── types/
│       └── index.ts
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── components.json                  # Configuração do shadcn/ui
├── tsconfig.json
├── Dockerfile
├── nginx.conf                       # Serve o build + proxy para API
├── package.json
└── .env.example
```

---

## Fases de Implementação

```
Fase 1 (Infra) → Fase 2 (Auth) → Fase 3 (Repos/Clone)
                                        ↓
                              Fase 4 (File System)
                             /         \
                    Fase 5 (Git)    Fase 6 (Terminal)
                             \         /
                          Fase 7 (Watcher)
                                  ↓
                           Fase 8 (Testes)
```

Fases 5 e 6 podem ser desenvolvidas em paralelo após a Fase 4 estar estabilizada.

---

### Fase 1 — Infraestrutura Base

Fastify + Vite rodando, Docker compondo os dois serviços.

**Dependências `api/`:**
```
fastify fastify-plugin
@fastify/cors @fastify/cookie @fastify/session @fastify/websocket @fastify/multipart @fastify/static
@octokit/rest octokit
zod pino-pretty
typescript @types/bun
```

> Removido `tsx` e `@types/node` — Bun roda TS diretamente e provê tipos via `@types/bun`.

**Dependências `web/`:**
```
react react-dom react-router-dom axios zustand
@monaco-editor/react
@xterm/xterm @xterm/addon-fit @xterm/addon-web-links
tailwindcss postcss autoprefixer
lucide-react
vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event
```

**Decisões:**
- Bun roda TS diretamente — sem build step para a api (`bun src/server.ts` em prod)
- `config.ts` valida todas as env vars com Zod no boot — falha imediatamente se ausente
- `WORKSPACES_ROOT` aceita path relativo (default `./.workspaces` em dev local) e é criado no boot via `fs.mkdirSync(..., { recursive: true })`
- `vite.config.ts` configura proxy `/api` → `http://localhost:3000` em dev local; em Docker o nginx faz o proxy
- `nginx.conf` em produção: `location /api/` proxy pass para o container da api, resto serve `dist/`
- Raiz do projeto tem `package.json` com `concurrently` para `bun run dev` subir api+web simultaneamente

**Dockerfiles:**
- `api/Dockerfile`: `oven/bun:1.1-alpine`, instala git/python/make/g++/bash (necessários para `simple-git` + `node-pty` build). Roda `bun src/server.ts` direto (sem build). Porta 3000.
- `web/Dockerfile`: stages `oven/bun → bun run build → nginx:alpine`. Porta 80.
- `docker-compose.yml` na raiz: serviços `api` e `web`, volume `workspace_data` montado em `/data/workspaces`, rede interna `ide_net`. `WORKSPACES_ROOT=/data/workspaces` injetado por env no compose.

---

### Fase 2 — GitHub OAuth + Sessão

Login com GitHub, token armazenado na sessão, rotas protegidas.

**Dependências `api/`:**
```
@fastify/session octokit @octokit/rest
```

**Endpoints:**
- `GET /api/auth/github` — redireciona para GitHub OAuth
- `GET /api/auth/github/callback` — troca `code` por `access_token`, salva na sessão, redireciona para o frontend
- `GET /api/auth/me` — retorna dados do usuário da sessão
- `POST /api/auth/logout` — destrói a sessão

**Decisões:**
- Sessão server-side com cookie `httpOnly; SameSite=Lax` — access token nunca exposto ao cliente
- State CSRF gerado com `crypto.randomBytes(16)` e validado no callback (rejeita state mismatch)
- `auth.middleware.ts` é preHandler que lê `request.session.user`, retorna 401 se ausente
- `fastify.d.ts` augmenta `FastifySessionObject` com `user` e `FastifyRequest` com `workspacePath`
- `octokit.ts` exporta factory `createOctokit(token)`
- Axios `client.ts` com `withCredentials: true` + interceptor que redireciona p/ `/login` em 401
- Frontend usa Zustand store `useAuthStore` para estado global de auth (substituiu Context API — mais simples)
- `ProtectedRoute` aguarda `fetchMe` resolver antes de redirecionar (evita flicker)
- Erros do callback redirecionam p/ `/login?error=...` e são exibidos via Sonner toast

**Componentes shadcn/ui:** `Button`, `Card`

---

### Fase 3 — Listagem e Clone de Repositórios

Usuário vê seus repos do GitHub e clona para o servidor.

**Dependências `api/`:**
```
simple-git
```

**Endpoints:**
- `GET /api/repos` — lista repos via Octokit
- `POST /api/repos/clone` — clona para `/data/workspaces/{userId}/{repoName}/`
- `GET /api/repos/local` — lista repos já clonados

**Decisões:**
- Clone autenticado via URL: `https://token@github.com/owner/repo.git`
- Path sempre resolvido como `path.join(WORKSPACES_ROOT, userId, repoName)`
- Clone inicial síncrono; evoluir para 202 + notificação WS nas próximas iterações

**Componentes shadcn/ui:** `Input`, `ScrollArea`, `Badge`, `Button`, `Dialog`, `Skeleton`

---

### Fase 4 — File System API + Árvore de Arquivos

Listar, ler, salvar e deletar arquivos do repositório clonado.

**Endpoints:**
- `GET /api/fs/tree?workspace=` — árvore JSON recursiva (exclui `.git/`, `node_modules/`)
- `GET /api/fs/file?workspace=&path=` — conteúdo como texto ou base64 para binários
- `PUT /api/fs/file` — salva arquivo
- `DELETE /api/fs/file?workspace=&path=` — deleta arquivo
- `POST /api/fs/upload` — multipart, salva binários (imagens, etc.)
- `POST /api/fs/mkdir` — cria diretório
- `POST /api/fs/rename` — renomeia/move

**Decisões:**
- `path.utils.ts`: `resolveSafe(workspaceRoot, userPath)` verifica que o path absoluto começa com `workspaceRoot` (path traversal prevention)
- `workspace.middleware.ts`: preHandler que valida e injeta `request.workspacePath`
- Leitura de árvore limitada a profundidade máxima configurável (default 10)
- Arquivos > 5MB retornam erro
- Monaco detecta `language` pela extensão do arquivo
- `editorStore` (Zustand): `tabs`, `activeTabId`, `dirtyFiles: Set<string>`
- Auto-save com debounce de 1s ou `Ctrl+S`

**Componentes shadcn/ui:** `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle`, `ScrollArea`, `Tabs`, `ContextMenu`, `Tooltip`

---

### Fase 5 — Git Panel

Visualizar status, diff, fazer add/commit/push/pull.

**Endpoints:**
- `GET /api/git/status?workspace=`
- `GET /api/git/diff?workspace=&file=`
- `GET /api/git/log?workspace=&limit=20`
- `GET /api/git/branches?workspace=`
- `POST /api/git/add` — `{ workspace, files: string[] }`
- `POST /api/git/commit` — `{ workspace, message }`
- `POST /api/git/push` — `{ workspace }`
- `POST /api/git/pull` — `{ workspace }`
- `POST /api/git/checkout` — `{ workspace, branch, create?: boolean }`

**Decisões:**
- `simple-git` instanciado por chamada com `baseDir` — sem instâncias globais
- Erros do git retornam 422 com stderr no body
- `GitDiffViewer` usa `MonacoDiffEditor` com `original` (HEAD) e `modified` (working tree)
- `useGitStatus` polling a cada 5s, invalidado pelo watcher

**Componentes shadcn/ui:** `Checkbox`, `Badge`, `Textarea`, `Button`, `Separator`, `Collapsible`, `ScrollArea`

---

### Fase 6 — Terminal Real (node-pty + WebSocket)

Terminal funcional no browser com shell real na VPS.

**Dependências `api/`:**
```
node-pty
```

**Dependências `web/`:**
```
@xterm/xterm @xterm/addon-fit @xterm/addon-web-links
```

**Protocolo WS:** `GET /api/terminal?workspace=`
- Dados do terminal: string pura
- Controle (resize): `{ type: 'resize', cols: 80, rows: 24 }`

**Decisões:**
- PTY spawna `/bin/bash` com `cwd = workspacePath` e `TERM=xterm-256color`
- Cada conexão WS = uma instância PTY; on WS close, kill o processo
- Múltiplas conexões simultâneas são independentes
- `FitAddon.fit()` chamado on mount e on resize (ResizeObserver)
- Limpar instância xterm e fechar WS no cleanup do `useEffect`

**Componentes shadcn/ui:** `Tabs`, `Button`

---

### Fase 7 — File Watcher (chokidar → WebSocket)

Frontend recebe notificação em tempo real quando arquivos mudam externamente.

**Dependências `api/`:**
```
chokidar
```

**Protocolo WS:** `GET /api/watcher?workspace=`
- Eventos: `{ event: 'add'|'change'|'unlink'|'addDir'|'unlinkDir', path: string }`
- Path relativo ao workspacePath

**Decisões:**
- `Map<workspacePath, FSWatcher>` reusa instâncias entre conexões do mesmo workspace
- Contador de conexões por workspace; fechar watcher quando chegar a zero
- Debounce nos eventos para evitar rafales durante operações git
- `useWatcher` invalida árvore, re-fetch de arquivo aberto (se não dirty) e git status

---

### Fase 8 — Testes e Qualidade

**`vitest.config.ts` (web):**
- `environment: 'jsdom'`
- `globals: true`
- `setupFiles: ['./src/test/setup.ts']`
- `coverage.provider: 'v8'`
- Excluir `src/components/ui/**` da cobertura (código gerado pelo shadcn)

**Testes prioritários `api/`:**
- `path.utils.ts` — casos de path traversal
- `fs.service.ts` — operações com fs mockado
- `auth.middleware.ts` — requests autorizados e não autorizados
- `git.service.ts` — simple-git mockado

**Testes prioritários `web/`:**
- `useFileTree` — mock do Axios, estados loading/error/success
- `useGitStatus` — polling e invalidação
- `FileTree` — render, click, context menu
- `GitCommitForm` — validação de formulário, chamada da API

---

## shadcn/ui por Área

| Área | Componentes |
|---|---|
| Layout | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` |
| Sidebar | `ScrollArea`, `Collapsible`, `Tooltip`, `Button` |
| File Tree | `ContextMenu`, `DropdownMenu`, `Dialog` |
| Editor | `Tabs`, `TabsList`, `TabsTrigger`, `Badge` |
| Git Panel | `Checkbox`, `Textarea`, `Badge`, `Separator`, `Collapsible`, `ScrollArea` |
| Terminal | `Tabs`, `Button` |
| Repos Page | `Input`, `Card`, `Badge`, `Skeleton`, `Button`, `Dialog` |
| Login | `Button`, `Card` |
| Global | `Sonner` (toasts), `AlertDialog` (confirmações) |

---

## Variáveis de Ambiente

### `api/.env.example`
```env
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
SESSION_SECRET=
WORKSPACES_ROOT=/data/workspaces
PORT=3000
FRONTEND_URL=http://localhost:5173
```

### `web/.env.example`
```env
VITE_API_BASE_URL=http://localhost:3000
```
