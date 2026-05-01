import type { FastifyInstance } from 'fastify';
import { requireAdmin, requireAuth } from '../../middlewares/auth.middleware.ts';
import { deleteRepoPermission, getRepoPermissions, postRepoPermission } from './permissions.controller.ts';

export default async function permissionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/repos/:repoId/permissions', { preHandler: requireAdmin }, getRepoPermissions);
  app.post('/repos/:repoId/permissions', { preHandler: requireAdmin }, postRepoPermission);
  app.delete('/repos/:repoId/permissions/:userId', { preHandler: requireAdmin }, deleteRepoPermission);
}
