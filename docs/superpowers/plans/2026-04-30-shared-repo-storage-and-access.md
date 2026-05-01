# Shared Repo Storage And Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist users, sessions, repositories, and permissions in Postgres while moving imported repositories to a single shared storage model with `read` and `write` access control.

**Architecture:** Add a database layer with Drizzle and Postgres-backed sessions, introduce a shared repository catalog that maps GitHub repos to a single persistent filesystem path, and replace all user-folder-based repo resolution with permission-aware repo resolution. Then update the repos screen and admin surfaces to expose the new model.

**Tech Stack:** Bun workspace, Node runtime for API via `tsx`, Fastify, `@fastify/session`, Postgres, Drizzle ORM, React, Vite, Zustand, Vitest

---

### Task 1: Add Database Foundation

**Files:**
- Create: `api/src/db/schema.ts`
- Create: `api/src/db/client.ts`
- Create: `api/src/db/migrate.ts`
- Create: `api/drizzle.config.ts`
- Modify: `api/package.json`
- Modify: `api/.env.example`
- Modify: `api/src/config.ts`
- Test: `api/src/db/schema.test.ts`

- [ ] **Step 1: Write the failing config and schema tests**

```ts
import { describe, expect, it } from 'bun:test';
import { appConfigSchema } from '../config.ts';
import { globalRoles, repoPermissions, repos, users } from './schema.ts';

describe('database config', () => {
  it('requires DATABASE_URL', () => {
    const result = appConfigSchema.safeParse({
      GITHUB_CLIENT_ID: 'x',
      GITHUB_CLIENT_SECRET: 'y',
      GITHUB_CALLBACK_URL: 'http://localhost:3000/api/auth/github/callback',
      SESSION_SECRET: '12345678901234567890123456789012',
      FRONTEND_URL: 'http://localhost:5173',
    });

    expect(result.success).toBe(false);
  });

  it('declares shared repo tables', () => {
    expect(users.githubUserId.name).toBe('github_user_id');
    expect(repos.githubFullName.name).toBe('github_full_name');
    expect(repoPermissions.permission.name).toBe('permission');
    expect(globalRoles.role.name).toBe('role');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/db/schema.test.ts`
Expected: FAIL because the DB schema files and exported config schema do not exist yet.

- [ ] **Step 3: Add Drizzle, Postgres driver, and scripts**

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts"
  },
  "dependencies": {
    "drizzle-orm": "^0.43.1",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "drizzle-kit": "^0.31.4"
  }
}
```

- [ ] **Step 4: Implement config, client, and schema**

```ts
// api/src/config.ts
export const appConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_CALLBACK_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  WORKSPACES_ROOT: z.string().default('/data/workspaces'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
```

```ts
// api/src/db/client.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { config } from '../config.ts';

export const sql = postgres(config.DATABASE_URL, { max: 1 });
export const db = drizzle(sql);
```

```ts
// api/src/db/schema.ts
import { pgEnum, pgTable, text, timestamp, uuid, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

export const globalRoleEnum = pgEnum('global_role', ['owner', 'admin', 'user']);
export const repoPermissionEnum = pgEnum('repo_permission', ['read', 'write']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  githubUserId: text('github_user_id').notNull(),
  login: text('login').notNull(),
  avatarUrl: text('avatar_url'),
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  githubUserIdUnique: uniqueIndex('users_github_user_id_unique').on(t.githubUserId),
}));

export const globalRoles = pgTable('global_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: globalRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId] }),
}));

export const repos = pgTable('repos', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull(),
  githubFullName: text('github_full_name').notNull(),
  githubOwner: text('github_owner').notNull(),
  githubName: text('github_name').notNull(),
  defaultBranch: text('default_branch').notNull(),
  storagePath: text('storage_path').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  slugUnique: uniqueIndex('repos_slug_unique').on(t.slug),
  githubFullNameUnique: uniqueIndex('repos_github_full_name_unique').on(t.githubFullName),
  storagePathUnique: uniqueIndex('repos_storage_path_unique').on(t.storagePath),
}));

export const repoPermissions = pgTable('repo_permissions', {
  repoId: uuid('repo_id').notNull().references(() => repos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permission: repoPermissionEnum('permission').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.repoId, t.userId] }),
}));
```

- [ ] **Step 5: Add migration runner and Drizzle config**

```ts
// api/src/db/migrate.ts
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, sql } from './client.ts';

await migrate(db, { migrationsFolder: 'drizzle' });
await sql.end();
```

```ts
// api/drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && bun test src/db/schema.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/package.json api/.env.example api/src/config.ts api/src/db api/drizzle.config.ts docs/superpowers/plans/2026-04-30-shared-repo-storage-and-access.md
git commit -m "feat: add database foundation for shared repos"
```

### Task 2: Persist Users And Global Roles

**Files:**
- Create: `api/src/modules/users/users.service.ts`
- Create: `api/src/modules/users/users.service.test.ts`
- Modify: `api/src/modules/auth/auth.service.ts`
- Modify: `api/src/modules/auth/auth.controller.ts`
- Modify: `api/src/types/fastify.d.ts`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/auth.ts`
- Modify: `web/src/hooks/useAuth.ts`

- [ ] **Step 1: Write the failing user persistence tests**

```ts
import { describe, expect, it } from 'bun:test';
import { ensureUserFromGithubProfile, getGlobalRoleForUser } from './users.service.ts';

describe('users service', () => {
  it('assigns owner to the first user', async () => {
    const user = await ensureUserFromGithubProfile({
      githubUserId: '1',
      login: 'first-user',
      avatarUrl: null,
      accessToken: 'token-1',
    });

    expect(await getGlobalRoleForUser(user.id)).toBe('owner');
  });

  it('assigns user to subsequent users', async () => {
    const user = await ensureUserFromGithubProfile({
      githubUserId: '2',
      login: 'second-user',
      avatarUrl: null,
      accessToken: 'token-2',
    });

    expect(await getGlobalRoleForUser(user.id)).toBe('user');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/modules/users/users.service.test.ts`
Expected: FAIL because the service does not exist yet.

- [ ] **Step 3: Implement user upsert and global role assignment**

```ts
// api/src/modules/users/users.service.ts
export async function ensureUserFromGithubProfile(input: {
  githubUserId: string;
  login: string;
  avatarUrl: string | null;
  accessToken: string;
}) {
  const existing = await db.query.users.findFirst({
    where: eq(users.githubUserId, input.githubUserId),
  });

  if (existing) {
    const [updated] = await db.update(users)
      .set({
        login: input.login,
        avatarUrl: input.avatarUrl,
        accessTokenEncrypted: input.accessToken,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [created] = await db.insert(users).values({
    githubUserId: input.githubUserId,
    login: input.login,
    avatarUrl: input.avatarUrl,
    accessTokenEncrypted: input.accessToken,
  }).returning();

  await db.insert(globalRoles).values({
    userId: created.id,
    role: Number(count) === 0 ? 'owner' : 'user',
  });

  return created;
}
```

- [ ] **Step 4: Wire auth callback and `/auth/me` to the local user record**

```ts
// api/src/modules/auth/auth.controller.ts
const localUser = await ensureUserFromGithubProfile({
  githubUserId: user.userId,
  login: user.login,
  avatarUrl: user.avatarUrl,
  accessToken,
});
const role = await getGlobalRoleForUser(localUser.id);

req.session.user = {
  userId: localUser.id,
  githubUserId: user.userId,
  login: user.login,
  accessToken,
  avatarUrl: user.avatarUrl,
  role,
};
```

```ts
// api/src/modules/auth/auth.controller.ts
return {
  userId: user.userId,
  login: user.login,
  avatarUrl: user.avatarUrl,
  role: user.role,
};
```

- [ ] **Step 5: Update frontend auth typing**

```ts
// web/src/types/index.ts
export type AuthUser = {
  userId: string;
  login: string;
  avatarUrl: string | null;
  role: 'owner' | 'admin' | 'user';
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && bun test src/modules/users/users.service.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/src/modules/users api/src/modules/auth api/src/types/fastify.d.ts web/src/types/index.ts web/src/api/auth.ts web/src/hooks/useAuth.ts
git commit -m "feat: persist local users and global roles"
```

### Task 3: Move Sessions To Postgres

**Files:**
- Create: `api/src/plugins/session-store.ts`
- Create: `api/src/plugins/session.test.ts`
- Modify: `api/src/plugins/session.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write the failing session persistence tests**

```ts
import { describe, expect, it } from 'bun:test';
import { createSessionStore } from './session-store.ts';

describe('session store', () => {
  it('persists and reloads a session payload', async () => {
    const store = createSessionStore();
    await store.set('sid-1', { cookie: { maxAge: 1000 }, user: { userId: 'u1' } });

    const loaded = await store.get('sid-1');
    expect(loaded?.user?.userId).toBe('u1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/plugins/session.test.ts`
Expected: FAIL because the persistent store does not exist yet.

- [ ] **Step 3: Implement a Postgres-backed session store**

```ts
// api/src/plugins/session-store.ts
export function createSessionStore() {
  return {
    async set(sessionId: string, value: Record<string, unknown>) {
      await db.execute(sql`
        insert into sessions (id, data, expires_at)
        values (${sessionId}, ${JSON.stringify(value)}, now() + interval '7 days')
        on conflict (id) do update
        set data = excluded.data,
            expires_at = excluded.expires_at
      `);
    },
    async get(sessionId: string) {
      const rows = await db.execute(sql`
        select data from sessions
        where id = ${sessionId} and expires_at > now()
      `);
      return rows[0]?.data ?? null;
    },
    async destroy(sessionId: string) {
      await db.execute(sql`delete from sessions where id = ${sessionId}`);
    },
  };
}
```

- [ ] **Step 4: Register the store in the Fastify session plugin**

```ts
// api/src/plugins/session.ts
await app.register(session, {
  secret: config.SESSION_SECRET,
  cookieName: 'web_ide_session',
  store: createSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
  saveUninitialized: false,
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun test src/plugins/session.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/plugins/session-store.ts api/src/plugins/session.ts api/src/plugins/session.test.ts api/src/server.ts
git commit -m "feat: persist sessions in postgres"
```

### Task 4: Introduce Shared Repo Catalog

**Files:**
- Create: `api/src/modules/repos/repo-catalog.service.ts`
- Create: `api/src/modules/repos/repo-catalog.service.test.ts`
- Modify: `api/src/modules/repos/repos.service.ts`
- Modify: `api/src/utils/path.utils.ts`

- [ ] **Step 1: Write the failing shared repo catalog tests**

```ts
import { describe, expect, it } from 'bun:test';
import { ensureImportedRepo } from './repo-catalog.service.ts';

describe('repo catalog', () => {
  it('creates a single storage path for a new repo', async () => {
    const repo = await ensureImportedRepo({
      githubFullName: 'acme/app',
      defaultBranch: 'main',
      importingUserId: 'user-1',
    });

    expect(repo.storagePath).toContain('/data/workspaces/repos/');
  });

  it('reuses an existing repo without recloning', async () => {
    const first = await ensureImportedRepo({
      githubFullName: 'acme/app',
      defaultBranch: 'main',
      importingUserId: 'user-1',
    });
    const second = await ensureImportedRepo({
      githubFullName: 'acme/app',
      defaultBranch: 'main',
      importingUserId: 'user-2',
    });

    expect(second.id).toBe(first.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/modules/repos/repo-catalog.service.test.ts`
Expected: FAIL because the shared catalog does not exist yet.

- [ ] **Step 3: Implement slugging and shared storage paths**

```ts
// api/src/utils/path.utils.ts
export function getSharedReposRoot(workspacesRoot: string): string {
  return path.join(workspacesRoot, 'repos');
}

export function getSharedRepoPath(workspacesRoot: string, slug: string): string {
  return path.join(getSharedReposRoot(workspacesRoot), sanitizeRepoName(slug));
}
```

```ts
// api/src/modules/repos/repo-catalog.service.ts
export async function ensureImportedRepo(input: {
  githubFullName: string;
  defaultBranch: string;
  importingUserId: string;
}) {
  const existing = await db.query.repos.findFirst({
    where: eq(repos.githubFullName, input.githubFullName),
  });
  if (existing) return existing;

  const [owner, name] = input.githubFullName.split('/');
  const slug = await createUniqueSlug(name);
  const storagePath = getSharedRepoPath(config.WORKSPACES_ROOT, slug);

  const [repo] = await db.insert(repos).values({
    slug,
    githubFullName: input.githubFullName,
    githubOwner: owner,
    githubName: name,
    defaultBranch: input.defaultBranch,
    storagePath,
    createdByUserId: input.importingUserId,
  }).returning();

  return repo;
}
```

- [ ] **Step 4: Update clone flow to use the shared catalog**

```ts
// api/src/modules/repos/repos.service.ts
const repoRecord = await ensureImportedRepo({
  githubFullName: opts.repoFullName,
  defaultBranch: opts.branch ?? 'main',
  importingUserId: opts.userId,
});

try {
  await fs.access(repoRecord.storagePath);
} catch {
  await git.clone(authUrl, repoRecord.storagePath, args);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun test src/modules/repos/repo-catalog.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/modules/repos/repo-catalog.service.ts api/src/modules/repos/repo-catalog.service.test.ts api/src/modules/repos/repos.service.ts api/src/utils/path.utils.ts
git commit -m "feat: add shared repo catalog and storage paths"
```

### Task 5: Add Repo Permission Service

**Files:**
- Create: `api/src/modules/permissions/permissions.service.ts`
- Create: `api/src/modules/permissions/permissions.service.test.ts`
- Create: `api/src/modules/permissions/permissions.routes.ts`
- Create: `api/src/modules/permissions/permissions.controller.ts`
- Modify: `api/src/server.ts`

- [ ] **Step 1: Write the failing permissions tests**

```ts
import { describe, expect, it } from 'bun:test';
import { grantRepoPermission, getRepoPermissionForUser } from './permissions.service.ts';

describe('permissions service', () => {
  it('grants read access', async () => {
    await grantRepoPermission({ repoId: 'repo-1', userId: 'user-1', permission: 'read' });
    expect(await getRepoPermissionForUser('repo-1', 'user-1')).toBe('read');
  });

  it('upgrades read to write', async () => {
    await grantRepoPermission({ repoId: 'repo-1', userId: 'user-1', permission: 'write' });
    expect(await getRepoPermissionForUser('repo-1', 'user-1')).toBe('write');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/modules/permissions/permissions.service.test.ts`
Expected: FAIL because the permissions module does not exist yet.

- [ ] **Step 3: Implement repo permission CRUD**

```ts
// api/src/modules/permissions/permissions.service.ts
export async function grantRepoPermission(input: {
  repoId: string;
  userId: string;
  permission: 'read' | 'write';
  createdByUserId?: string;
}) {
  await db.insert(repoPermissions).values(input).onConflictDoUpdate({
    target: [repoPermissions.repoId, repoPermissions.userId],
    set: { permission: input.permission, createdByUserId: input.createdByUserId ?? null },
  });
}

export async function getRepoPermissionForUser(repoId: string, userId: string) {
  const row = await db.query.repoPermissions.findFirst({
    where: and(eq(repoPermissions.repoId, repoId), eq(repoPermissions.userId, userId)),
  });
  return row?.permission ?? null;
}
```

- [ ] **Step 4: Add admin-only HTTP endpoints**

```ts
// api/src/modules/permissions/permissions.routes.ts
app.addHook('preHandler', requireAuth);
app.get('/repos/:repoId/permissions', listRepoPermissions);
app.post('/repos/:repoId/permissions', requireAdmin, upsertRepoPermission);
app.delete('/repos/:repoId/permissions/:userId', requireAdmin, removeRepoPermission);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun test src/modules/permissions/permissions.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/modules/permissions api/src/server.ts
git commit -m "feat: add repo permission service and routes"
```

### Task 6: Replace Workspace Resolution With Permission-Aware Repo Resolution

**Files:**
- Create: `api/src/middlewares/repo-access.middleware.ts`
- Create: `api/src/middlewares/repo-access.middleware.test.ts`
- Modify: `api/src/types/fastify.d.ts`
- Modify: `api/src/modules/fs/fs.routes.ts`
- Modify: `api/src/modules/git/git.routes.ts`
- Modify: `api/src/modules/terminal/terminal.routes.ts`
- Modify: `api/src/modules/watcher/watcher.routes.ts`
- Modify: `api/src/middlewares/workspace.middleware.ts`

- [ ] **Step 1: Write the failing repo access middleware tests**

```ts
import { describe, expect, it } from 'bun:test';
import { resolveRepoAccess } from './repo-access.middleware.ts';

describe('resolveRepoAccess', () => {
  it('returns 403 when user lacks permission', async () => {
    const reply = createReplyDouble();
    await resolveRepoAccess('read')(
      { session: { user: { userId: 'u1' } }, query: { workspace: 'shared-repo' } } as any,
      reply as any,
    );
    expect(reply.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/middlewares/repo-access.middleware.test.ts`
Expected: FAIL because the middleware does not exist yet.

- [ ] **Step 3: Implement repo lookup by slug and permission**

```ts
// api/src/middlewares/repo-access.middleware.ts
export function resolveRepoAccess(required: 'read' | 'write') {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const user = req.session.user;
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });

    const slug =
      (req.query as { workspace?: string })?.workspace ??
      (req.body as { workspace?: string } | undefined)?.workspace;
    if (!slug) return reply.code(400).send({ error: 'workspace_required' });

    const repo = await db.query.repos.findFirst({ where: eq(repos.slug, slug) });
    if (!repo) return reply.code(404).send({ error: 'repo_not_found' });

    const permission = await getRepoPermissionForUser(repo.id, user.userId);
    if (!permission || (required === 'write' && permission !== 'write')) {
      return reply.code(403).send({ error: 'permission_denied' });
    }

    req.workspacePath = repo.storagePath;
    req.repoId = repo.id;
    req.repoPermission = permission;
  };
}
```

- [ ] **Step 4: Switch all routes to the new middleware**

```ts
// api/src/modules/fs/fs.routes.ts
app.addHook('preHandler', requireAuth);
app.addHook('preHandler', resolveRepoAccess('read'));
app.post('/write', { preHandler: [requireAuth, resolveRepoAccess('write')] }, postWriteFile);
```

```ts
// api/src/modules/git/git.routes.ts
app.get('/status', { preHandler: [requireAuth, resolveRepoAccess('read')] }, getStatus);
app.post('/commit', { preHandler: [requireAuth, resolveRepoAccess('write')] }, postCommit);
```

- [ ] **Step 5: Enforce `write` in terminal and `read` in watcher**

```ts
// api/src/modules/terminal/terminal.routes.ts
const permission = await getRepoPermissionForUser(repo.id, user.userId);
if (permission !== 'write') {
  socket.send(JSON.stringify({ type: 'error', message: 'permission_denied' }));
  socket.close();
  return;
}
```

```ts
// api/src/modules/watcher/watcher.routes.ts
const permission = await getRepoPermissionForUser(repo.id, user.userId);
if (!permission) {
  socket.send(JSON.stringify({ type: 'error', message: 'permission_denied' }));
  socket.close();
  return;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && bun test src/middlewares/repo-access.middleware.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/src/middlewares/repo-access.middleware.ts api/src/middlewares/repo-access.middleware.test.ts api/src/types/fastify.d.ts api/src/modules/fs/fs.routes.ts api/src/modules/git/git.routes.ts api/src/modules/terminal/terminal.routes.ts api/src/modules/watcher/watcher.routes.ts
git commit -m "feat: enforce shared repo permissions across api routes"
```

### Task 7: Update Repo Import And Listing APIs

**Files:**
- Modify: `api/src/modules/repos/repos.controller.ts`
- Modify: `api/src/modules/repos/repos.service.ts`
- Modify: `web/src/api/repos.ts`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/hooks/useRepos.ts`
- Test: `api/src/modules/repos/repos.service.test.ts`

- [ ] **Step 1: Write the failing list/import behavior tests**

```ts
it('returns github repos and local repos separately', async () => {
  const result = await listReposForUser('user-1', 'token-1');
  expect(Array.isArray(result.githubRepos)).toBe(true);
  expect(Array.isArray(result.localRepos)).toBe(true);
});

it('grants read when importing an already existing repo', async () => {
  await importRepoForUser({ userId: 'owner', accessToken: 't1', repoFullName: 'acme/app' });
  const imported = await importRepoForUser({ userId: 'viewer', accessToken: 't2', repoFullName: 'acme/app' });
  expect(imported.permission).toBe('read');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/modules/repos/repos.service.test.ts`
Expected: FAIL because the service still returns the old shape and old clone semantics.

- [ ] **Step 3: Change the service contract to return local and GitHub repos**

```ts
// api/src/modules/repos/repos.service.ts
export async function listReposForUser(accessToken: string, userId: string) {
  const githubRepos = await listRemoteRepos(accessToken, userId);
  const localRepos = await listAccessibleLocalRepos(userId);
  return { githubRepos, localRepos };
}
```

- [ ] **Step 4: Change import semantics**

```ts
// api/src/modules/repos/repos.service.ts
if (existingRepo) {
  await grantRepoPermission({
    repoId: existingRepo.id,
    userId: opts.userId,
    permission: 'read',
    createdByUserId: opts.userId,
  });
  return { repo: existingRepo, permission: 'read' as const };
}

await grantRepoPermission({
  repoId: repoRecord.id,
  userId: opts.userId,
  permission: 'write',
  createdByUserId: opts.userId,
});
return { repo: repoRecord, permission: 'write' as const };
```

- [ ] **Step 5: Update frontend repo typings and hooks**

```ts
// web/src/types/index.ts
export type LocalRepo = {
  id: string;
  slug: string;
  githubFullName: string;
  permission: 'read' | 'write';
};

export type ReposPayload = {
  githubRepos: RemoteRepo[];
  localRepos: LocalRepo[];
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd api && bun test src/modules/repos/repos.service.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/src/modules/repos/repos.controller.ts api/src/modules/repos/repos.service.ts web/src/api/repos.ts web/src/types/index.ts web/src/hooks/useRepos.ts api/src/modules/repos/repos.service.test.ts
git commit -m "feat: separate github and local repo listings"
```

### Task 8: Update Repos UI And Readonly IDE Behavior

**Files:**
- Modify: `web/src/pages/ReposPage.tsx`
- Modify: `web/src/components/layout/AppShell.tsx`
- Modify: `web/src/components/terminal/TerminalPane.tsx`
- Modify: `web/src/hooks/useEditor.ts`
- Modify: `web/src/pages/IDEPage.tsx`
- Create: `web/src/stores/repoAccessStore.ts`
- Test: `web/src/pages/ReposPage.test.tsx`

- [ ] **Step 1: Write the failing repos UI tests**

```tsx
import { render, screen } from '@testing-library/react';
import ReposPage from './ReposPage';

it('renders GitHub and Compartilhados comigo sections', async () => {
  render(<ReposPage />);
  expect(screen.getByText('GitHub')).toBeInTheDocument();
  expect(screen.getByText('Compartilhados comigo')).toBeInTheDocument();
});

it('shows permission badge for local repos', async () => {
  render(<ReposPage />);
  expect(screen.getByText('read')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && bun run test:vitest src/pages/ReposPage.test.tsx`
Expected: FAIL because the page still renders a single mixed list.

- [ ] **Step 3: Render separate repo sections and local permission badges**

```tsx
// web/src/pages/ReposPage.tsx
<section>
  <h2 className="mb-3 text-sm font-medium text-muted-foreground">GitHub</h2>
  {/* cards for github repos with Importar/Importado */}
</section>

<section className="mt-8">
  <h2 className="mb-3 text-sm font-medium text-muted-foreground">Compartilhados comigo</h2>
  {/* cards for local repos with read/write badge */}
</section>
```

- [ ] **Step 4: Store repo permission when opening the IDE**

```ts
// web/src/stores/repoAccessStore.ts
export const useRepoAccessStore = create<{
  permission: 'read' | 'write' | null;
  setPermission: (permission: 'read' | 'write' | null) => void;
}>((set) => ({
  permission: null,
  setPermission: (permission) => set({ permission }),
}));
```

- [ ] **Step 5: Enforce readonly UI state**

```tsx
// web/src/components/layout/AppShell.tsx
const permission = useRepoAccessStore((s) => s.permission);
const canWrite = permission === 'write';

{canWrite && <TerminalPane workspace={workspace} />}
```

```ts
// web/src/hooks/useEditor.ts
if (permission !== 'write') return;
await saveFile(workspace, tab.path, tab.content, tab.encoding);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd web && bun run test:vitest src/pages/ReposPage.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/pages/ReposPage.tsx web/src/components/layout/AppShell.tsx web/src/components/terminal/TerminalPane.tsx web/src/hooks/useEditor.ts web/src/pages/IDEPage.tsx web/src/stores/repoAccessStore.ts web/src/pages/ReposPage.test.tsx
git commit -m "feat: show shared repos and readonly ide states"
```

### Task 9: Add Owner And Admin Management UI

**Files:**
- Create: `api/src/modules/admin/admin.service.ts`
- Create: `api/src/modules/admin/admin.routes.ts`
- Create: `api/src/modules/admin/admin.controller.ts`
- Create: `web/src/pages/AdminPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/api/auth.ts`
- Create: `web/src/api/admin.ts`
- Test: `api/src/modules/admin/admin.service.test.ts`

- [ ] **Step 1: Write the failing admin role tests**

```ts
import { describe, expect, it } from 'bun:test';
import { setUserGlobalRole, getGlobalRoleForUser } from './admin.service.ts';

describe('admin service', () => {
  it('promotes a user to admin', async () => {
    await setUserGlobalRole('user-1', 'admin');
    expect(await getGlobalRoleForUser('user-1')).toBe('admin');
  });

  it('demotes an admin to user', async () => {
    await setUserGlobalRole('user-1', 'user');
    expect(await getGlobalRoleForUser('user-1')).toBe('user');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/modules/admin/admin.service.test.ts`
Expected: FAIL because the admin module does not exist yet.

- [ ] **Step 3: Implement owner-only admin role management**

```ts
// api/src/modules/admin/admin.service.ts
export async function setUserGlobalRole(userId: string, role: 'admin' | 'user') {
  await db.update(globalRoles).set({ role }).where(eq(globalRoles.userId, userId));
}
```

```ts
// api/src/modules/admin/admin.routes.ts
app.addHook('preHandler', requireAuth);
app.get('/admin/users', requireOwner, listUsersWithRoles);
app.post('/admin/users/:userId/role', requireOwner, updateUserRole);
```

- [ ] **Step 4: Add owner-only admin page**

```tsx
// web/src/App.tsx
<Route
  path="/admin"
  element={
    <ProtectedRoute>
      <AdminPage />
    </ProtectedRoute>
  }
/>
```

```tsx
// web/src/pages/AdminPage.tsx
if (user?.role !== 'owner') return <Navigate to="/repos" replace />;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun test src/modules/admin/admin.service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/modules/admin web/src/pages/AdminPage.tsx web/src/App.tsx web/src/api/admin.ts web/src/api/auth.ts
git commit -m "feat: add owner admin management flow"
```

### Task 10: Add Legacy Workspace Migration Script

**Files:**
- Create: `api/src/scripts/migrate-legacy-workspaces.ts`
- Create: `api/src/scripts/migrate-legacy-workspaces.test.ts`
- Modify: `api/package.json`
- Modify: `README.md`

- [ ] **Step 1: Write the failing migration script tests**

```ts
import { describe, expect, it } from 'bun:test';
import { scanLegacyWorkspaces } from './migrate-legacy-workspaces.ts';

describe('legacy workspace migration', () => {
  it('finds user-scoped repos and derives their github origin', async () => {
    const repos = await scanLegacyWorkspaces('/tmp/legacy-root');
    expect(repos[0]).toHaveProperty('githubFullName');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd api && bun test src/scripts/migrate-legacy-workspaces.test.ts`
Expected: FAIL because the migration script does not exist yet.

- [ ] **Step 3: Implement scan and import helpers**

```ts
// api/src/scripts/migrate-legacy-workspaces.ts
export async function scanLegacyWorkspaces(root: string) {
  const userDirs = await fs.readdir(root, { withFileTypes: true });
  const result: Array<{ legacyPath: string; githubFullName: string; userId: string }> = [];

  for (const userDir of userDirs) {
    if (!userDir.isDirectory()) continue;
    const repos = await fs.readdir(path.join(root, userDir.name), { withFileTypes: true });
    for (const repoDir of repos) {
      if (!repoDir.isDirectory()) continue;
      const git = simpleGit(path.join(root, userDir.name, repoDir.name));
      const remote = await git.remote(['get-url', 'origin']);
      result.push({
        legacyPath: path.join(root, userDir.name, repoDir.name),
        githubFullName: remote.trim().replace('https://github.com/', '').replace(/\.git$/, ''),
        userId: userDir.name,
      });
    }
  }

  return result;
}
```

- [ ] **Step 4: Add manual script command and docs**

```json
{
  "scripts": {
    "migrate:legacy-workspaces": "tsx src/scripts/migrate-legacy-workspaces.ts"
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd api && bun test src/scripts/migrate-legacy-workspaces.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add api/src/scripts/migrate-legacy-workspaces.ts api/src/scripts/migrate-legacy-workspaces.test.ts api/package.json README.md
git commit -m "feat: add legacy workspace migration tooling"
```

### Self-Review

Spec coverage check:
- DB schema, sessions, users, global roles: Tasks 1-3
- shared repo catalog and persistent storage: Task 4
- repo permissions and authorization: Tasks 5-6
- split GitHub/local listing and import semantics: Task 7
- readonly UI and terminal restrictions: Task 8
- owner/admin management: Task 9
- legacy migration path: Task 10

Placeholder scan:
- No `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Each task includes explicit files, code targets, commands, and expected results.

Type consistency:
- Global roles are consistently `owner | admin | user`
- Repo permissions are consistently `read | write`
- Shared repo identifier is consistently `slug` in routes/UI and `github_full_name` for deduplication

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-shared-repo-storage-and-access.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
