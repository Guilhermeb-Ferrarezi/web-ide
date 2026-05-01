import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.ts';
import { repoPermissions, repos } from '../../db/schema.ts';
import { and, eq } from 'drizzle-orm';
import { grantRepoPermission, removeRepoPermission } from './permissions.service.ts';
import { findUserByLogin, searchUsersByLogin } from '../users/users.service.ts';
import { createOctokit } from '../../utils/octokit.ts';

const paramsSchema = z.object({
  repoId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

const searchUsersQuerySchema = z.object({
  query: z.string().default(''),
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
  const [targetUser, repo] = await Promise.all([
    body.userId
      ? db.query.users.findFirst({ where: (fields, ops) => ops.eq(fields.id, body.userId!) })
      : findUserByLogin(body.login!),
    db.query.repos.findFirst({ where: eq(repos.id, repoId) }),
  ]);
  if (!targetUser) {
    return reply.code(404).send({
      error: 'user_not_found',
      message: 'Usuario nao encontrado. Ele precisa entrar na plataforma pelo menos uma vez.',
    });
  }
  if (!repo) return reply.code(404).send({ error: 'repo_not_found' });

  await grantRepoPermission({
    repoId,
    userId: targetUser.id,
    permission: body.permission,
    createdByUserId: req.session.user!.userId,
  });

  const octokit = createOctokit(req.session.user!.accessToken);
  try {
    await octokit.repos.addCollaborator({
      owner: repo.githubOwner,
      repo: repo.githubName,
      username: targetUser.login,
      permission: body.permission === 'write' ? 'push' : 'pull',
    });
  } catch (err) {
    req.log.warn({ err }, 'GitHub collaborator sync failed — permission saved locally anyway');
  }

  return reply.send({ ok: true });
}

export async function getShareUsers(req: FastifyRequest, reply: FastifyReply) {
  paramsSchema.parse(req.params);
  const { query } = searchUsersQuerySchema.parse(req.query);
  const users = await searchUsersByLogin(query);
  return reply.send(users);
}

export async function deleteRepoPermission(req: FastifyRequest, reply: FastifyReply) {
  const { repoId, userId } = paramsSchema.parse(req.params);
  if (!userId) return reply.code(400).send({ error: 'user_id_required' });

  const [repo, targetUser] = await Promise.all([
    db.query.repos.findFirst({ where: eq(repos.id, repoId) }),
    db.query.users.findFirst({ where: (fields, ops) => ops.eq(fields.id, userId) }),
  ]);

  await removeRepoPermission(repoId, userId);

  if (repo && targetUser) {
    const octokit = createOctokit(req.session.user!.accessToken);
    try {
      await octokit.repos.removeCollaborator({
        owner: repo.githubOwner,
        repo: repo.githubName,
        username: targetUser.login,
      });
    } catch (err) {
      req.log.warn({ err }, 'GitHub collaborator removal failed — permission removed locally anyway');
    }
  }

  return reply.code(204).send();
}
