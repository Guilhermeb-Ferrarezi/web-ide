import { eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { globalRoles, users } from '../../db/schema.ts';

export async function listUsersWithRoles() {
  const rows = await db.query.users.findMany();
  return Promise.all(
    rows.map(async (user) => {
      const role = await db.query.globalRoles.findFirst({
        where: eq(globalRoles.userId, user.id),
      });
      return {
        id: user.id,
        githubUserId: user.githubUserId,
        login: user.login,
        avatarUrl: user.avatarUrl,
        role: role?.role ?? 'user',
      };
    }),
  );
}

export async function setUserGlobalRole(userId: string, role: 'admin' | 'user') {
  await db.update(globalRoles).set({ role }).where(eq(globalRoles.userId, userId));
}
