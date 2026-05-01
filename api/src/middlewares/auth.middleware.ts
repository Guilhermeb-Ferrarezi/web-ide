import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!req.session.user) {
    return reply.code(401).send({ error: 'unauthenticated' });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const role = req.session.user?.role;
  if (!role) {
    return reply.code(401).send({ error: 'unauthenticated' });
  }
  if (role !== 'admin' && role !== 'owner') {
    return reply.code(403).send({ error: 'admin_only' });
  }
}

export async function requireOwner(req: FastifyRequest, reply: FastifyReply) {
  const role = req.session.user?.role;
  if (!role) {
    return reply.code(401).send({ error: 'unauthenticated' });
  }
  if (role !== 'owner') {
    return reply.code(403).send({ error: 'owner_only' });
  }
}
