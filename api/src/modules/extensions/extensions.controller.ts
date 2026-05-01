import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { installExtension, searchExtensions } from './extensions.service.ts';

const searchQuerySchema = z.object({
  query: z.string().optional(),
});

const installBodySchema = z.object({
  extensionId: z.string().min(3),
});

export async function getExtensions(req: FastifyRequest, reply: FastifyReply) {
  const query = searchQuerySchema.parse(req.query);
  const extensions = await searchExtensions(query.query ?? '');
  return reply.send({ extensions });
}

export async function postInstallExtension(req: FastifyRequest, reply: FastifyReply) {
  const body = installBodySchema.parse(req.body);
  try {
    return reply.send(await installExtension(body.extensionId));
  } catch (err) {
    return reply.code(422).send({ error: 'extension_install_failed', message: (err as Error).message });
  }
}
