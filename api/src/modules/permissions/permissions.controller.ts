import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.ts';
import { repoPermissions } from '../../db/schema.ts';
import { eq } from 'drizzle-orm';
import { grantRepoPermission, removeRepoPermission } from './permissions.service.ts';
import { findUserByLogin } from '../users/users.service.ts';

const paramsSchema = z.object({
  repoId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

const bodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    login: z.string().min(1).optional(),
    permission: z.enum(['read', 'write']),
  })
  .refine((body) => Boolean(body.userId || body.login), {
    message: 'userId_or_login_required',
  });

export async function getRepoPermissions(req: FastifyRequest, reply: FastifyReply) {
  const { repoId } = paramsSchema.parse(req.params);
  const rows = await db.query.repoPermissions.findMany({
    where: eq(repoPermissions.repoId, repoId),
  });
  const userIds = rows.map((r) => r.userId);
  const userRows = userIds.length
    ? await db.query.users.findMany({ where: (fields, ops) => ops.inArray(fields.id, userIds) })
    : [];
  const byUserId = new Map(userRows.map((u) => [u.id, u]));
  return reply.send(
    rows.map((row) => ({
      userId: row.userId,
      login: byUserId.get(row.userId)?.login ?? null,
      permission: row.permission,
    })),
  );
}

export async function postRepoPermission(req: FastifyRequest, reply: FastifyReply) {
  const { repoId } = paramsSchema.parse(req.params);
  const body = bodySchema.parse(req.body);
  const targetUser = body.userId
    ? await db.query.users.findFirst({ where: (fields, ops) => ops.eq(fields.id, body.userId!) })
    : await findUserByLogin(body.login!);
  if (!targetUser) {
    return reply.code(404).send({
      error: 'user_not_found',
      message: 'Usuario nao encontrado. Ele precisa entrar na plataforma pelo menos uma vez.',
    });
  }
  await grantRepoPermission({
    repoId,
    userId: targetUser.id,
    permission: body.permission,
    createdByUserId: req.session.user!.userId,
  });
  return reply.send({ ok: true });
}

export async function deleteRepoPermission(req: FastifyRequest, reply: FastifyReply) {
  const { repoId, userId } = paramsSchema.parse(req.params);
  if (!userId) return reply.code(400).send({ error: 'user_id_required' });
  await removeRepoPermission(repoId, userId);
  return reply.code(204).send();
}
