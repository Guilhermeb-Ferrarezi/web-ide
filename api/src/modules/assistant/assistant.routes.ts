import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveRepoAccess } from '../../middlewares/repo-access.middleware.ts';
import { postChat } from './assistant.controller.ts';

export default async function assistantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/assistant/chat', { preHandler: resolveRepoAccess('write') }, postChat);
}
