# Shared Repo Storage And Access Design

## Goal

Adicionar persistência real de repositórios importados na VPS, acesso compartilhado por usuários específicos e papéis administrativos globais, preservando login e permissões no banco.

## Context

Hoje a aplicação:

- guarda workspaces por `userId` no filesystem
- resolve acesso ao repo pela sessão atual e pelo nome do workspace
- usa sessão em memória, o que derruba login após restart da API

O alvo agora é:

- uma cópia única de cada repositório importado na VPS
- repositórios persistidos fora do container via bind mount
- usuários vendo apenas:
  - seus repositórios no GitHub
  - repositórios locais compartilhados com eles
- permissões por repositório com `read` e `write`
- `owner` global único
- `admin` global gerenciando permissões de repositório
- persistência de login no Postgres

## Non-Goals

- sincronização automática de todos os repositórios do GitHub
- branching por usuário
- múltiplas working trees por repositório
- workflow de aprovação de acesso
- auditoria detalhada de todas as ações

## Storage Model

### Filesystem

Os repositórios importados deixam de existir em paths por usuário e passam a usar cópia única compartilhada:

- mount persistente da API:
  - host: `/opt/web-ide/workspaces`
  - container: `/data/workspaces`
- estrutura interna:
  - `/data/workspaces/repos/<repo-slug>`

Exemplo:

- `/data/workspaces/repos/calendario-santos-games`

Esse diretório contém a working tree única e o `.git` correspondente.

### Database

O Postgres passa a ser a fonte de verdade para:

- usuários locais
- sessão persistente
- papéis globais
- catálogo de repositórios importados
- permissões por repositório

O filesystem deixa de determinar posse. Ele só armazena os arquivos.

## Roles And Permissions

### Global Roles

- `owner`
  - primeiro usuário do sistema
  - único que pode promover e rebaixar admins
- `admin`
  - gerencia acesso de usuários aos repositórios
- `user`
  - papel padrão para usuários autenticados

### Repo Permissions

- `read`
  - ver repositório na listagem local
  - abrir árvore de arquivos
  - ler arquivos
  - ver status e diffs de git
- `write`
  - inclui tudo de `read`
  - editar/salvar/deletar/renomear/upload
  - executar operações mutáveis de git
  - usar terminal interativo do repositório

## Data Model

### `users`

- `id` UUID
- `github_user_id` string unique
- `login` string
- `avatar_url` string nullable
- `access_token_encrypted` text
- `created_at`
- `updated_at`

Uso:

- persistir identidade local
- manter token do GitHub necessário para clone/pull/push

### `global_roles`

- `user_id` FK unique
- `role` enum `owner | admin | user`
- `created_at`

Regra:

- um usuário tem um único papel global efetivo

### `repos`

- `id` UUID
- `slug` string unique
- `github_full_name` string unique
- `github_owner` string
- `github_name` string
- `default_branch` string
- `storage_path` string unique
- `created_by_user_id` FK
- `created_at`
- `updated_at`

Uso:

- mapear um repo GitHub para uma working tree única na VPS

### `repo_permissions`

- `repo_id` FK
- `user_id` FK
- `permission` enum `read | write`
- `created_by_user_id` FK nullable
- `created_at`
- unique `(repo_id, user_id)`

Regra:

- cada usuário tem no máximo uma permissão explícita por repositório

### `sessions`

Persistidas no Postgres.

Pode ser uma tabela própria da aplicação ou a tabela esperada pelo store escolhido para `@fastify/session`. O requisito funcional é:

- restart da API não derruba login
- expiração continua sendo controlada por cookie e sessão persistida

## Authentication And Session Flow

1. usuário autentica com GitHub
2. callback resolve `github_user_id`, `login`, `avatar_url` e `access_token`
3. sistema faz upsert de `users`
4. se ainda não existir usuário no banco, o primeiro criado recebe papel `owner`
5. os demais recebem `user`
6. a sessão HTTP é salva em store persistente no Postgres
7. novos requests e websockets resolvem o usuário a partir da sessão persistida

## Repo Import Flow

### New Repo

Quando `github_full_name` ainda não existe:

1. validar que o usuário autenticado enxerga esse repositório no GitHub
2. gerar `slug` interno estável
3. montar `storage_path = /data/workspaces/repos/<slug>`
4. clonar uma vez para esse path
5. criar registro em `repos`
6. conceder `write` ao importador

### Existing Repo

Quando `github_full_name` já existe:

1. não reclonar
2. se o usuário ainda não tiver permissão, conceder `read`
3. retornar o repositório local já existente

Esse comportamento implementa deduplicação por repositório GitHub.

## Visibility Rules

Quando o usuário abre a tela de repositórios, ela exibe:

- repositórios remotos do GitHub visíveis para aquele usuário
- repositórios locais em que ele tenha `read` ou `write`

O usuário não deve ver:

- repositórios locais sem permissão
- catálogos locais globais de outros usuários

## Authorization Rules By Area

### Repo Resolution

Toda área que hoje resolve `workspacePath` por `userId + workspace` precisa passar a resolver por:

- repositório local selecionado
- lookup no banco
- verificação de permissão do usuário na sessão

### FS

- `read`: leitura de árvore e arquivos
- `write`: escrita, remoção, rename, mkdir, upload

### Git

- `read`: status, diff, log, branches
- `write`: add, unstage, commit, pull, push, checkout

### Watcher

- `read` suficiente

### Terminal

- `write` obrigatório

Isso evita terminal interativo para usuários somente leitura.

## API Changes

### Auth

- persistir usuário local no callback
- trocar sessão em memória por store em Postgres
- expor papel global do usuário autenticado em `/auth/me`

### Repos

Substituir a listagem atual por resposta estruturada em dois blocos:

- `githubRepos`
- `localRepos`

Adicionar semântica de importação deduplicada:

- se repo novo: clone + create + grant `write`
- se repo existente: grant `read`

### Permissions

Novas rotas para admin:

- listar permissões de um repositório
- conceder `read`
- promover para `write`
- remover acesso

### Admin Management

Novas rotas para owner:

- listar usuários
- promover para `admin`
- rebaixar para `user`

## UI Changes

### Repos Page

Adicionar seções:

- `GitHub`
- `Compartilhados comigo`

Cada repositório local deve indicar se o acesso é `read` ou `write`.

### Repo Permission Management

Adicionar painel para admin:

- buscar usuários
- conceder `read`
- trocar para `write`
- remover acesso

### Global Admin Management

Adicionar tela do owner para:

- listar usuários
- promover admin
- rebaixar admin

### IDE Restrictions

Quando o usuário tem apenas `read`:

- editor readonly
- ações mutáveis escondidas ou desabilitadas
- terminal indisponível

## Migration Strategy

### Phase 1: Database Foundation

- adicionar conexão Postgres
- adicionar Drizzle
- criar schema e migrations
- criar sessão persistente no banco

### Phase 2: User Persistence

- persistir usuários no callback do GitHub
- introduzir papel global
- marcar primeiro usuário como `owner`

### Phase 3: Shared Repo Catalog

- criar tabela `repos`
- mover resolução de repositório para catálogo local
- usar `storage_path` compartilhado

### Phase 4: Repo Permissions

- criar tabela `repo_permissions`
- aplicar checks de permissão nos módulos `fs`, `git`, `watcher`, `terminal`

### Phase 5: UI And Admin Flows

- separar listagem `GitHub` e `Compartilhados comigo`
- adicionar UI de permissões
- adicionar UI de admins

### Phase 6: Legacy Workspace Migration

Opcionalmente, criar script de migração dos workspaces antigos por usuário para o novo catálogo compartilhado.

O script deve:

- varrer diretórios legados
- identificar `origin`
- derivar `github_full_name`
- criar slug único
- mover ou registrar repo no novo storage
- conceder `write` ao usuário dono antigo

## Error Handling

Casos que precisam resposta explícita:

- `repo_not_found`
- `permission_denied`
- `repo_import_failed`
- `repo_already_exists_but_inaccessible`
- `admin_only`
- `owner_only`
- `session_expired`

## Security Notes

- token do GitHub deve ser persistido protegido, não em texto puro se houver mecanismo simples de criptografia disponível
- repositório local só pode ser aberto por permissão do banco
- o `slug` interno não deve ser a única barreira de acesso
- filesystem deve continuar protegido por `resolveSafe`

## Testing Strategy

### Backend

Cobrir:

- criação do primeiro usuário como `owner`
- usuários seguintes como `user`
- promoção e rebaixamento de admins
- importação de repo novo
- importação de repo já existente
- enforcement de `read` e `write`
- bloqueio de terminal para `read`
- persistência de sessão após restart lógico

### Frontend

Cobrir:

- renderização de seções `GitHub` e `Compartilhados comigo`
- estado readonly
- visibilidade de ações administrativas conforme papel global

## Open Decisions Already Resolved

- banco: Postgres
- ORM: Drizzle
- persistência de arquivos: bind mount
- cópia única por repositório: sim
- importação de repo existente: concede `read`
- primeiro usuário vira `owner`
- apenas `owner` promove/rebaixa admins
- admins gerenciam permissões por repositório
- permissões por repo: `read` e `write`

## Recommended Implementation Order

1. Postgres + Drizzle + sessions persistentes
2. persistência de usuários e papéis globais
3. catálogo compartilhado de repositórios
4. enforcement de permissões no backend
5. atualização da UI de repositórios
6. gestão de admins e permissões
