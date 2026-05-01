import type { FastifyInstance } from 'fastify';
import { requireAuth, requireOwner } from '../../middlewares/auth.middleware.ts';
import { getUsers, postUserRole } from './admin.controller.ts';

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/admin/users', { preHandler: requireOwner }, getUsers);
  app.post('/admin/users/:userId/role', { preHandler: requireOwner }, postUserRole);
}
