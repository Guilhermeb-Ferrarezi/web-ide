import { asc, count, eq, ilike } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { config } from '../../config.ts';
import { globalRoles, users } from '../../db/schema.ts';
import { encryptSecret } from '../../utils/crypto.ts';

export type StoredGlobalRole = 'owner' | 'admin' | 'user';
export type AppRole = StoredGlobalRole | 'terminal_superuser';

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
    const [updated] = await db
      .update(users)
      .set({
        login: input.login,
        avatarUrl: input.avatarUrl,
        accessTokenEncrypted: encryptSecret(input.accessToken),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }

  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  const [created] = await db
    .insert(users)
    .values({
      githubUserId: input.githubUserId,
      login: input.login,
      avatarUrl: input.avatarUrl,
      accessTokenEncrypted: encryptSecret(input.accessToken),
    })
    .returning();

  await db.insert(globalRoles).values({
    userId: created.id,
    role: userCount === 0 ? 'owner' : 'user',
  });

  return created;
}

export async function getGlobalRoleForUser(userId: string): Promise<StoredGlobalRole> {
  const role = await db.query.globalRoles.findFirst({
    where: eq(globalRoles.userId, userId),
  });
  return role?.role ?? 'user';
}

export async function findUserByLogin(login: string) {
  return db.query.users.findFirst({
    where: eq(users.login, login),
  });
}

export async function searchUsersByLogin(query: string, limit = 8) {
  const normalized = query.trim().replace(/^@/, '');
  if (!normalized) return [];

  const rows = await db.query.users.findMany({
    where: ilike(users.login, `%${normalized}%`),
    columns: {
      id: true,
      login: true,
      avatarUrl: true,
    },
    orderBy: [asc(users.login)],
    limit,
  });

  return rows.map((row) => ({
    userId: row.id,
    login: row.login,
    avatarUrl: row.avatarUrl,
  }));
}

export function resolveAppRole(
  storedRole: StoredGlobalRole,
  input: {
    userId: string;
    githubUserId: string;
    login: string;
    terminalSuperusers?: string[];
  },
): AppRole {
  const terminalSuperusers = input.terminalSuperusers ?? config.TERMINAL_SUPERUSERS_LIST;
  const candidates = [input.userId, input.githubUserId, input.login]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return candidates.some((candidate) => terminalSuperusers.includes(candidate)) ? 'terminal_superuser' : storedRole;
}
