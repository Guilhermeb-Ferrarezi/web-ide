import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveWorkspace } from '../../middlewares/workspace.middleware.ts';
import { postChat } from './assistant.controller.ts';

export default async function assistantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.post('/assistant/chat', { preHandler: resolveWorkspace }, postChat);
}
