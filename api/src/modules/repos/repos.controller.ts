import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { deleteLocalRepo, importRepo, listLocalRepos, listReposForUser } from './repos.service.ts';

const cloneSchema = z.object({
  repoFullName: z.string().regex(/^[^/]+\/[^/]+$/),
  branch: z.string().optional(),
});

const listReposQuerySchema = z.object({
  githubPage: z.coerce.number().int().min(1).default(1),
  localPage: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const repoNameParam = z.object({ name: z.string().min(1) });

export async function getRemoteRepos(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  const query = listReposQuerySchema.parse(req.query);
  const repos = await listReposForUser(user.accessToken, user.userId, query);
  return reply.send(repos);
}

export async function getLocalRepos(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  const repos = await listLocalRepos(user.userId);
  return reply.send(repos);
}

export async function postClone(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  const body = cloneSchema.parse(req.body);
  try {
    const result = await importRepo({
      userId: user.userId,
      accessToken: user.accessToken,
      repoFullName: body.repoFullName,
      branch: body.branch,
    });
    return reply.code(201).send(result);
  } catch (err) {
    const msg = (err as Error).message;
    req.log.error({ err }, 'Clone failed');
    return reply.code(500).send({ error: 'clone_failed', message: msg });
  }
}

export async function deleteRepo(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  const { name } = repoNameParam.parse(req.params);
  await deleteLocalRepo(user.userId, name);
  return reply.code(204).send();
}
