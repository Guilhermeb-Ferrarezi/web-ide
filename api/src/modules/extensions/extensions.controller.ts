import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getExtensionDetail, getInstalledExtensions, installExtension, searchExtensions } from './extensions.service.ts';

const searchQuerySchema = z.object({
  query: z.string().optional(),
  q: z.string().optional(),
});

const installBodySchema = z.object({
  extensionId: z.string().min(3),
});
const extensionParamsSchema = z.object({
  extensionId: z.string().min(3),
});

export async function getExtensions(req: FastifyRequest, reply: FastifyReply) {
  const query = searchQuerySchema.parse(req.query);
  const extensions = await searchExtensions(query.query ?? query.q ?? '');
  return reply.send({ extensions });
}

export async function postInstallExtension(req: FastifyRequest, reply: FastifyReply) {
  const body = installBodySchema.parse(req.body);
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  try {
    return reply.send(await installExtension({ extensionId: body.extensionId, userId: user.userId }));
  } catch (err) {
    return reply.code(422).send({ error: 'extension_install_failed', message: (err as Error).message });
  }
}

export async function getInstalledExtensionsState(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  return reply.send(await getInstalledExtensions({ userId: user.userId }));
}

export async function getExtensionById(req: FastifyRequest, reply: FastifyReply) {
  const { extensionId } = extensionParamsSchema.parse(req.params);
  try {
    return reply.send(await getExtensionDetail(extensionId));
  } catch (err) {
    return reply.code(404).send({ error: 'extension_not_found', message: (err as Error).message });
  }
}
