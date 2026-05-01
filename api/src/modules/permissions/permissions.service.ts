import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { repoPermissions, repos } from '../../db/schema.ts';

export async function grantRepoPermission(input: {
  repoId: string;
  userId: string;
  permission: 'read' | 'write';
  createdByUserId?: string | null;
}) {
  await db
    .insert(repoPermissions)
    .values({
      repoId: input.repoId,
      userId: input.userId,
      permission: input.permission,
      createdByUserId: input.createdByUserId ?? null,
    })
    .onConflictDoUpdate({
      target: [repoPermissions.repoId, repoPermissions.userId],
      set: {
        permission: input.permission,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
}

export async function getRepoPermissionForUser(repoId: string, userId: string): Promise<'read' | 'write' | null> {
  const row = await db.query.repoPermissions.findFirst({
    where: and(eq(repoPermissions.repoId, repoId), eq(repoPermissions.userId, userId)),
  });
  return row?.permission ?? null;
}

export async function removeRepoPermission(repoId: string, userId: string) {
  await db.delete(repoPermissions).where(and(eq(repoPermissions.repoId, repoId), eq(repoPermissions.userId, userId)));
}

export async function canManageRepo(repoId: string, userId: string, role?: 'owner' | 'admin' | 'user' | 'terminal_superuser') {
  if (role === 'owner' || role === 'admin') return true;
  const repo = await db.query.repos.findFirst({
    where: eq(repos.id, repoId),
  });
  return repo?.createdByUserId === userId;
}
