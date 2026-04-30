import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveWorkspace } from '../../middlewares/workspace.middleware.ts';
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
  app.addHook('preHandler', resolveWorkspace);

  app.get('/fs/tree', getTree);
  app.get('/fs/file', getFile);
  app.put('/fs/file', putFile);
  app.delete('/fs/file', deleteFile);
  app.post('/fs/mkdir', postMkdir);
  app.post('/fs/rename', postRename);
  app.post('/fs/upload', postUpload);
}
