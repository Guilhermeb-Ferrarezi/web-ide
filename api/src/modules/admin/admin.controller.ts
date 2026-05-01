import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { listUsersWithRoles, setUserGlobalRole } from './admin.service.ts';

const paramsSchema = z.object({ userId: z.string().uuid() });
const roleSchema = z.object({ role: z.enum(['admin', 'user']) });

export async function getUsers(req: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listUsersWithRoles());
}

export async function postUserRole(req: FastifyRequest, reply: FastifyReply) {
  const { userId } = paramsSchema.parse(req.params);
  const { role } = roleSchema.parse(req.body);
  await setUserGlobalRole(userId, role);
  return reply.send({ ok: true });
}
