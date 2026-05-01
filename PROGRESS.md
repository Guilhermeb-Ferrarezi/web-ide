# Progresso do Projeto

Acompanhamento de fases do [PLAN.md](./PLAN.md).

## Status

| Fase | Status | Notas |
|---|---|---|
| 1 — Infraestrutura Base | ✅ Concluída | Bun, Fastify, Vite, Tailwind, shadcn, Docker, scripts unificados |
| 2 — GitHub OAuth + Sessão | ✅ Concluída | Login, callback com state CSRF, sessão httpOnly, ProtectedRoute |
| 3 — Listagem e Clone de Repositórios | ✅ Concluída | Lista, busca, clone autenticado, delete, navegação para IDE |
| 4 — File System API + Árvore | ✅ Concluída | tree/read/write/delete/upload/mkdir/rename, AppShell, FileTree, Monaco com tabs e dirty state |
| 5 — Git Panel | ✅ Concluída | status, diff, add/unstage, commit, push, pull, checkout |
| 6 — Terminal (node-pty) | ✅ Concluída | WebSocket + xterm.js + FitAddon + ResizeObserver |
| 7 — File Watcher (chokidar) | ✅ Concluída | WS /api/watcher, pool por workspace, bus global no front, invalidação de árvore/git/arquivo aberto |
| 8 — Testes | ✅ Concluída | path.utils, fs.service, auth.middleware, git.service na api; useFileTree, useGitStatus, FileTree, watcherBus no web |

---

## Fase 1 — Infraestrutura Base ✅

**Concluído em:** 2026-04-30

### Estrutura criada
- `web-ide/` raiz com `package.json` (workspaces), `docker-compose.yml`, `.gitignore`, `README.md`, `PLAN.md`
- `api/` — Bun + Fastify + TypeScript
- `web/` — Vite + React + Tailwind + shadcn

### Arquivos
- **api/**: `package.json`, `tsconfig.json`, `.env.example`, `Dockerfile`, `.dockerignore`, `src/server.ts`, `src/config.ts`, `src/types/fastify.d.ts`, `src/plugins/{cors,cookie,session,websocket}.ts`
- **web/**: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`, `nginx.conf`, `Dockerfile`, `src/{main,App,index.css}`, `src/api/client.ts`, `src/lib/utils.ts`, `src/test/setup.ts`

### Decisões aplicadas
- Bun como runtime + package manager + test runner (substitui Node/npm/Vitest CLI; Vitest disponível como fallback `test:vitest`)
- `WORKSPACES_ROOT` aceita path relativo (default `./.workspaces`), criado automaticamente no boot
- `concurrently` na raiz para `bun run dev` subir api+web
- Vite proxy `/api` → `http://localhost:3000` em dev
- Tailwind dark mode default (`<html class="dark">`)

---

## Fase 2 — GitHub OAuth + Sessão ✅

**Concluído em:** 2026-04-30

### Endpoints
- `GET /api/auth/github` — gera state CSRF, redireciona p/ GitHub
- `GET /api/auth/github/callback` — valida state, troca code→token, fetch user, salva na sessão, redireciona p/ `/repos`
- `GET /api/auth/me` — retorna user da sessão (401 se ausente)
- `POST /api/auth/logout` — destrói sessão

### Arquivos novos
- **api/**: `utils/octokit.ts`, `modules/auth/{auth.service,auth.controller,auth.routes}.ts`, `middlewares/auth.middleware.ts`
- **web/**: `types/index.ts`, `api/auth.ts`, `hooks/useAuth.ts`, `components/ui/{button,card}.tsx`, `components/shared/ProtectedRoute.tsx`, `pages/{LoginPage,ReposPage}.tsx`

### Dependências adicionadas
- api: `fastify-plugin`, `pino-pretty`

### Decisões aplicadas
- State OAuth gerado com `crypto.randomBytes(16)` e validado no callback
- Access token armazenado APENAS na sessão server-side (cookie httpOnly), nunca enviado ao frontend
- `useAuth` é Zustand store global (substituiu o `Context` originalmente sugerido) — mais simples, mesma DX
- `ProtectedRoute` aguarda `fetchMe` antes de redirecionar (evita flicker)
- Erros do callback voltam para `/login?error=...` e são exibidos via Sonner toast

### Pendências
- Não há sessão persistente (Redis) — em desenvolvimento sessão fica em memória do processo. Para produção real, registrar `connect-redis` ou store equivalente.

---

## Fase 3 — Listagem e Clone de Repositórios ✅

**Concluído em:** 2026-04-30

### Endpoints
- `GET /api/repos` — lista repos do GitHub (Octokit `listForAuthenticatedUser`, sort=updated, per_page=100), marca `cloned: true` se já existir no disco
- `GET /api/repos/local` — lista diretórios em `WORKSPACES_ROOT/{userId}/`
- `POST /api/repos/clone` — clona via simple-git com URL autenticada (`x-access-token:TOKEN@github.com/...`), depois reescreve remote `origin` para URL pública (sem expor token no `.git/config`)
- `DELETE /api/repos/local/:name` — remove pasta do disco

### Arquivos novos
- **api/**: `utils/path.utils.ts` (sanitize + resolveSafe), `modules/repos/{repos.service,repos.controller,repos.routes}.ts`
- **web/**: `api/repos.ts`, `hooks/useRepos.ts`, `components/ui/{input,badge,skeleton}.tsx`, `pages/ReposPage.tsx` (refeito)

### Decisões aplicadas
- **Token nunca persistido em disco**: clone usa URL com token apenas durante a operação, depois `git remote set-url origin` para a URL pública. Token continua só na sessão do servidor.
- **Sanitização de nomes**: `sanitizeRepoName` rejeita nomes vazios, com `..`, com chars perigosos ou >100 caracteres
- **`cloned` flag** já vem na listagem remota — evita 2 requisições no front
- Clone síncrono nesta fase (responde quando terminar). Para repos grandes, evoluir para job + polling/WebSocket numa fase futura
- Rotas de repos protegidas por `addHook('preHandler', requireAuth)` — todas exigem sessão

### Pendências
- Sem paginação (limita aos 100 primeiros) — adicionar quando necessário
- Sem feedback de progresso durante clone (apenas spinner) — pode evoluir com SSE/WS na Fase 7

---

## Fase 4 — File System API + Árvore + Monaco ✅

**Concluído em:** 2026-04-30

### Endpoints
- `GET /api/fs/tree?workspace=` — árvore JSON recursiva (ignora `.git`, `node_modules`, `.next`, `dist`, `build`, `.DS_Store`; profundidade máx 10)
- `GET /api/fs/file?workspace=&path=` — texto utf-8 ou base64 (binários até 5MB)
- `PUT /api/fs/file` — body `{ workspace, path, content, encoding }`
- `DELETE /api/fs/file?workspace=&path=`
- `POST /api/fs/mkdir`, `POST /api/fs/rename`, `POST /api/fs/upload` (multipart, até 25MB)

### Arquivos novos
- **api/**: `middlewares/workspace.middleware.ts`, `modules/fs/{fs.service,fs.controller,fs.routes}.ts`
- **web/**: `api/fs.ts`, `lib/language.ts`, `stores/{workspaceStore,editorStore}.ts`, `hooks/{useFileTree,useEditor}.ts`, `components/ui/{scroll-area,resizable}.tsx`, `components/file-tree/{FileTree,FileTreeNode}.tsx`, `components/editor/{EditorTabs,EditorPane}.tsx`, `components/layout/{AppShell,StatusBar}.tsx`, `pages/IDEPage.tsx`

### Decisões aplicadas
- **Path traversal** bloqueado em `resolveSafe` — toda operação fs passa por ele
- **Detecção texto vs binário**: lista de extensões de texto conhecidas. Outros tratados como base64 + mimeType
- **Imagens** renderizadas inline via `data:` URL (PNG/JPG/SVG/GIF/WebP)
- **Outros binários** mostram placeholder (não tentam abrir no Monaco)
- **Auto-save**: NÃO implementado neste passo — só `Ctrl+S` (preferência por commit explícito). Decidir auto-save quando integrar com o watcher (Fase 7) para evitar race conditions
- **Dirty tracking** via comparação `content !== originalContent` no `editorStore`
- **`workspaceStore`** mantém o nome do workspace ativo separado do estado do editor — facilita reset ao sair da rota
- `IDEPage` reseta editor ao montar/desmontar (evita lixo entre repos diferentes)

### Pendências
- Sem context menu (rename/delete/new file/upload via UI) — ficam para próxima iteração de polish
- Sem drag-and-drop de upload — usar endpoint `/fs/upload` quando precisar

---

## Fase 5 — Git Panel ✅

**Concluído em:** 2026-04-30

### Endpoints
- `GET /api/git/status` — branch, ahead/behind, staged, unstaged, untracked
- `GET /api/git/diff?file=&staged=` — diff cru do git
- `GET /api/git/log?limit=` — últimos N commits
- `GET /api/git/branches` — local branches + atual
- `POST /api/git/add`, `/git/unstage`, `/git/commit`, `/git/push`, `/git/pull`, `/git/checkout`

### Arquivos novos
- **api/**: `modules/git/{git.service,git.controller,git.routes}.ts`
- **web/**: `api/git.ts`, `hooks/useGitStatus.ts`, `components/git/{GitPanel,GitFileList}.tsx`, `components/ui/{checkbox,textarea,separator,tabs}.tsx`

### Decisões aplicadas
- **Push/pull com token temporário**: mesmo padrão do clone — reescreve `origin` para URL com token, executa, restaura URL pública. Garante que `.git/config` nunca persiste o token
- **Polling de status** a cada 5s (será substituído pelo watcher na Fase 7)
- **Erros de git** retornam 422 com mensagem do stderr — exibidos via toast
- Sem `MonacoDiffEditor` ainda — diff cru disponível via API mas a UI não tem viewer dedicado (próximo polish)

---

## Fase 6 — Terminal (node-pty + xterm) ✅

**Concluído em:** 2026-04-30

### Endpoint
- `WS /api/terminal?workspace=` — stream bidirecional de PTY

### Arquivos novos
- **api/**: `modules/terminal/{terminal.service,terminal.routes}.ts`
- **web/**: `hooks/useTerminal.ts`, `components/terminal/TerminalPane.tsx`

### Decisões aplicadas
- **Shell**: `process.env.SHELL` (fallback `/bin/bash`), com `TERM=xterm-256color`, `COLORTERM=truecolor`
- **Protocolo WS**: input cru como string, mensagens de controle JSON `{ type: 'resize', cols, rows }` (e opcional `{ type: 'input', data }`)
- **Auth**: lê `req.session.user` no upgrade — sessão herdada do mesmo cookie
- **Resize automático**: `ResizeObserver` no container do xterm chama `FitAddon.fit()` e envia novo tamanho via WS
- **Cleanup**: ao fechar WS, mata o PTY; ao desmontar componente, fecha WS + dispose do terminal
- **Layout**: AppShell agora tem activity bar (10px) → side panel (Files/Git) → editor + terminal vertical resizable

---

## Fase 7 — File Watcher (chokidar → WebSocket) ✅

**Concluído em:** 2026-04-30

### Endpoint
- `WS /api/watcher?workspace=` — emite eventos JSON `{ kind: 'fs', event, path }` ou `{ kind: 'git', path }`. Envia `{ kind: 'ready' }` ao conectar.

### Arquivos novos
- **api/**: `modules/watcher/{watcher.service,watcher.routes}.ts`
- **web/**: `hooks/useWatcher.ts`, `lib/watcherBus.ts`

### Decisões aplicadas
- **Pool por workspacePath**: `Map<absPath, { watcher, listeners }>` reusa a mesma instância chokidar entre conexões; quando o último listener sai, fecha o watcher.
- **Eventos `.git/*`** são reclassificados como `{ kind: 'git', path }` — diferencia operações git de mudanças de arquivo do usuário.
- **Ignorados**: `node_modules`, `dist`, `build`, `.next`, `.DS_Store` (regex). `.git` é observado para detectar commits/checkouts.
- **awaitWriteFinish**: 80ms para evitar disparos parciais durante salvamentos.
- **Bus global no front** (`watcherBus`): IDEPage abre uma única conexão WS via `useWatcher` e emite no bus; `useFileTree`, `useGitStatus` e o reload de tab consomem do bus — evita N conexões.
- **Polling git de 5s removido** — `useGitStatus` reage ao bus com debounce 250ms.
- **`useFileTree` ignora `change`** (somente add/unlink/addDir/unlinkDir reorganizam a árvore) com debounce 200ms.
- **Reload de tab aberta**: se o arquivo do tab ativo muda externamente e não está dirty, IDEPage faz `fetchFile` e atualiza `originalContent` + `content`. Se foi removido, fecha a tab.
- **Reconexão automática**: hook tenta reconectar a cada 2s em caso de queda do WS.

### Pendências
- Sem indicador visual de "arquivo modificado externamente" quando o tab está dirty (apenas mantém local — usuário decide via Ctrl+S/discard).

---

## Fase 8 — Testes ✅

**Concluído em:** 2026-04-30

### Cobertura inicial

**api (bun:test) — 46 testes:**
- `utils/path.utils.test.ts` — sanitização de userId/repoName, `resolveSafe` com casos de path traversal (`..`, absoluto, prefixo coincidente, normalização)
- `modules/fs/fs.service.test.ts` — readTree (ordenação, ignored, profundidade), readFile (texto/binário), writeFile/deletePath/makeDir/renamePath/uploadFile com workspace temporário (`mkdtemp`)
- `middlewares/auth.middleware.test.ts` — 401 sem sessão, passa com sessão
- `modules/git/git.service.test.ts` — repo git real em tmp dir: status, add, unstage, commit, log, branches, checkout

**web (vitest) — 14 testes:**
- `hooks/useFileTree.test.ts` — mock de axios, estados loading/success/error, refresh manual
- `hooks/useGitStatus.test.ts` — mount, falha, debounce de eventos do watcher, ignora `kind: 'ready'`
- `components/file-tree/FileTree.test.tsx` — render vazio, render com nós, refresh
- `lib/watcherBus.test.ts` — pub/sub, unsubscribe, isolamento de erros de listener

### Comandos
- Raiz: `bun run test` (api + vitest)
- Só api: `cd api && bun test`
- Só web: `cd web && bun run test:vitest`

### Decisões aplicadas
- **Tests reais sempre que possível**: `fs.service` e `git.service` operam em `mkdtemp` em vez de mockar fs/simple-git — pega regressões reais de I/O e do binário git
- **Hooks com axios mockado** via `vi.mock('@/api/...')` — testa estado/efeito sem rede
- **Componentes**: focado em FileTree (lógica de renderização e refresh) — GitPanel deixado para iteração futura por ter mais ramificações de UI

### Pendências
- Sem testes para `repos.service`, `terminal.service`, `watcher.service` (envolvem rede/processo/IO contínuo — exigem fixtures mais elaboradas)
- Sem testes E2E (Playwright) — fora do escopo desta iteração
- Coverage report ainda não rodado regularmente
