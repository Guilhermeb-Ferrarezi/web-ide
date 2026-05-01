import { pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const globalRoleEnum = pgEnum('global_role', ['owner', 'admin', 'user']);
export const repoPermissionEnum = pgEnum('repo_permission', ['read', 'write']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    githubUserId: text('github_user_id').notNull(),
    login: text('login').notNull(),
    avatarUrl: text('avatar_url'),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    githubUserIdUnique: uniqueIndex('users_github_user_id_unique').on(t.githubUserId),
  }),
);

export const globalRoles = pgTable(
  'global_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: globalRoleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId] }),
  }),
);

export const repos = pgTable(
  'repos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    githubFullName: text('github_full_name').notNull(),
    githubOwner: text('github_owner').notNull(),
    githubName: text('github_name').notNull(),
    defaultBranch: text('default_branch').notNull(),
    storagePath: text('storage_path').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugUnique: uniqueIndex('repos_slug_unique').on(t.slug),
    githubFullNameUnique: uniqueIndex('repos_github_full_name_unique').on(t.githubFullName),
    storagePathUnique: uniqueIndex('repos_storage_path_unique').on(t.storagePath),
  }),
);

export const repoPermissions = pgTable(
  'repo_permissions',
  {
    repoId: uuid('repo_id')
      .notNull()
      .references(() => repos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: repoPermissionEnum('permission').notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.repoId, t.userId] }),
  }),
);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
