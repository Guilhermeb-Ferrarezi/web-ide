import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveWorkspace } from '../../middlewares/workspace.middleware.ts';
import * as ctrl from './git.controller.ts';

export default async function gitRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.addHook('preHandler', resolveWorkspace);

  app.get('/git/status', ctrl.getStatus);
  app.get('/git/diff', ctrl.getDiff);
  app.get('/git/log', ctrl.getLog);
  app.get('/git/branches', ctrl.getBranches);
  app.post('/git/add', ctrl.postAdd);
  app.post('/git/unstage', ctrl.postUnstage);
  app.post('/git/commit', ctrl.postCommit);
  app.post('/git/push', ctrl.postPush);
  app.post('/git/pull', ctrl.postPull);
  app.post('/git/checkout', ctrl.postCheckout);
}
