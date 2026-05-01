import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { deleteRepo, getLocalRepos, getRemoteBranches, getRemoteRepos, postClone, postInit } from './repos.controller.ts';

export default async function reposRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/repos', getRemoteRepos);
  app.get('/repos/branches', getRemoteBranches);
  app.get('/repos/local', getLocalRepos);
  app.post('/repos/clone', postClone);
  app.post('/repos/init', postInit);
  app.delete('/repos/local/:name', deleteRepo);
}
