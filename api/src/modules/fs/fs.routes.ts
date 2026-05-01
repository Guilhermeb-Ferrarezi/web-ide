import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveRepoAccess } from '../../middlewares/repo-access.middleware.ts';
import {
  deleteFile,
  getFile,
  getTree,
  postMkdir,
  postRename,
  postUpload,
  putFile,
} from './fs.controller.ts';

export default async function fsRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  app.addHook('preHandler', requireAuth);
  app.get('/fs/tree', { preHandler: resolveRepoAccess('read') }, getTree);
  app.get('/fs/file', { preHandler: resolveRepoAccess('read') }, getFile);
  app.put('/fs/file', { preHandler: resolveRepoAccess('write') }, putFile);
  app.delete('/fs/file', { preHandler: resolveRepoAccess('write') }, deleteFile);
  app.post('/fs/mkdir', { preHandler: resolveRepoAccess('write') }, postMkdir);
  app.post('/fs/rename', { preHandler: resolveRepoAccess('write') }, postRename);
  app.post('/fs/upload', { preHandler: resolveRepoAccess('write') }, postUpload);
}
