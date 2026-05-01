import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveRepoAccess } from '../../middlewares/repo-access.middleware.ts';
import * as ctrl from './git.controller.ts';

export default async function gitRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/git/status', { preHandler: resolveRepoAccess('read') }, ctrl.getStatus);
  app.get('/git/diff', { preHandler: resolveRepoAccess('read') }, ctrl.getDiff);
  app.get('/git/log', { preHandler: resolveRepoAccess('read') }, ctrl.getLog);
  app.get('/git/branches', { preHandler: resolveRepoAccess('read') }, ctrl.getBranches);
  app.post('/git/add', { preHandler: resolveRepoAccess('write') }, ctrl.postAdd);
  app.post('/git/unstage', { preHandler: resolveRepoAccess('write') }, ctrl.postUnstage);
  app.post('/git/commit', { preHandler: resolveRepoAccess('write') }, ctrl.postCommit);
  app.post('/git/push', { preHandler: resolveRepoAccess('write') }, ctrl.postPush);
  app.post('/git/pull', { preHandler: resolveRepoAccess('write') }, ctrl.postPull);
  app.post('/git/checkout', { preHandler: resolveRepoAccess('write') }, ctrl.postCheckout);
}
