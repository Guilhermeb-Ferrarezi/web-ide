import { count, eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { globalRoles, users } from '../../db/schema.ts';
import { encryptSecret } from '../../utils/crypto.ts';

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

export async function getGlobalRoleForUser(userId: string): Promise<'owner' | 'admin' | 'user'> {
  const role = await db.query.globalRoles.findFirst({
    where: eq(globalRoles.userId, userId),
  });
  return role?.role ?? 'user';
}
