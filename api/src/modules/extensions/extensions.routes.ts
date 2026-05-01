import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { getExtensionById, getExtensions, postInstallExtension } from './extensions.controller.ts';

export default async function extensionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/extensions/search', getExtensions);
  app.get('/extensions/:extensionId', getExtensionById);
  app.post('/extensions/install', postInstallExtension);
}
