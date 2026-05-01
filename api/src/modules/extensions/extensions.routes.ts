import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { getExtensions, postInstallExtension } from './extensions.controller.ts';

export default async function extensionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/extensions/search', getExtensions);
  app.post('/extensions/install', postInstallExtension);
}
