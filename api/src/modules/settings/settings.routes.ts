import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { getSettings, putSetting } from './settings.controller.ts';

export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/settings', getSettings);
  app.put('/settings/:key', putSetting);
}
