import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as gitService from './git.service.ts';

export async function getStatus(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await gitService.getStatus(req.workspacePath!));
}

const diffQuery = z.object({ workspace: z.string(), file: z.string().optional(), staged: z.coerce.boolean().optional() });
export async function getDiff(req: FastifyRequest, reply: FastifyReply) {
  const q = diffQuery.parse(req.query);
  const diff = await gitService.getDiff(req.workspacePath!, q.file, q.staged ?? false);
  return reply.send({ diff });
}

export async function getLog(req: FastifyRequest, reply: FastifyReply) {
  const q = req.query as { limit?: string };
  const limit = q.limit ? parseInt(q.limit, 10) : 20;
  return reply.send(await gitService.getLog(req.workspacePath!, limit));
}

export async function getBranches(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await gitService.getBranches(req.workspacePath!));
}

const filesSchema = z.object({ workspace: z.string(), files: z.array(z.string()).min(1) });
export async function postAdd(req: FastifyRequest, reply: FastifyReply) {
  const body = filesSchema.parse(req.body);
  await gitService.addFiles(req.workspacePath!, body.files);
  return reply.send({ ok: true });
}

export async function postUnstage(req: FastifyRequest, reply: FastifyReply) {
  const body = filesSchema.parse(req.body);
  await gitService.unstageFiles(req.workspacePath!, body.files);
  return reply.send({ ok: true });
}

const commitSchema = z.object({ workspace: z.string(), message: z.string().min(1) });
export async function postCommit(req: FastifyRequest, reply: FastifyReply) {
  const body = commitSchema.parse(req.body);
  try {
    const result = await gitService.commit(req.workspacePath!, body.message, req.session.user);
    return reply.send({ ok: true, commit: result.commit });
  } catch (err) {
    return reply.code(422).send({ error: 'commit_failed', message: (err as Error).message });
  }
}

export async function postPush(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  try {
    const result = await gitService.push(req.workspacePath!, user.accessToken);
    return reply.send({ ok: true, result });
  } catch (err) {
    return reply.code(422).send({ error: 'push_failed', message: (err as Error).message });
  }
}

export async function postPull(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user!;
  try {
    const result = await gitService.pull(req.workspacePath!, user.accessToken);
    return reply.send({ ok: true, result });
  } catch (err) {
    return reply.code(422).send({ error: 'pull_failed', message: (err as Error).message });
  }
}

const checkoutSchema = z.object({ workspace: z.string(), branch: z.string().min(1), create: z.boolean().optional() });
export async function postCheckout(req: FastifyRequest, reply: FastifyReply) {
  const body = checkoutSchema.parse(req.body);
  await gitService.checkout(req.workspacePath!, body.branch, body.create);
  return reply.send({ ok: true });
}
