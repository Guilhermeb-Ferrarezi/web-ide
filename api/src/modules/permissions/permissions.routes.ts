import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { deleteRepoPermission, getRepoPermissions, getShareUsers, postRepoPermission } from './permissions.controller.ts';
import { canManageRepo } from './permissions.service.ts';

async function requireRepoManager(req: any, reply: any) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  const repoId = req.params?.repoId;
  if (!repoId) return reply.code(400).send({ error: 'repo_id_required' });
  const allowed = await canManageRepo(repoId, user.userId, user.role);
  if (!allowed) return reply.code(403).send({ error: 'repo_manager_only' });
}

export default async function permissionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/repos/:repoId/share-users', { preHandler: requireRepoManager }, getShareUsers);
  app.get('/repos/:repoId/permissions', { preHandler: requireRepoManager }, getRepoPermissions);
  app.post('/repos/:repoId/permissions', { preHandler: requireRepoManager }, postRepoPermission);
  app.delete('/repos/:repoId/permissions/:userId', { preHandler: requireRepoManager }, deleteRepoPermission);
}
