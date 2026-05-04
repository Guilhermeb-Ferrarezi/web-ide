import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { resolveRepoAccess } from '../../middlewares/repo-access.middleware.ts';
import {
  deleteFile,
  getFile,
  getProjectFiles,
  getSearch,
  getTree,
  getTypes,
  postMkdir,
  postRename,
  postUpload,
  putFile,
} from './fs.controller.ts';

export default async function fsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);
  app.get('/fs/tree', { preHandler: resolveRepoAccess('read') }, getTree);
  app.get('/fs/types', { preHandler: resolveRepoAccess('read') }, getTypes);
  app.get('/fs/project-files', { preHandler: resolveRepoAccess('read') }, getProjectFiles);
  app.get('/fs/search', { preHandler: resolveRepoAccess('read') }, getSearch);
  app.get('/fs/file', { preHandler: resolveRepoAccess('read') }, getFile);
  app.put('/fs/file', { preHandler: resolveRepoAccess('write') }, putFile);
  app.delete('/fs/file', { preHandler: resolveRepoAccess('write') }, deleteFile);
  app.post('/fs/mkdir', { preHandler: resolveRepoAccess('write') }, postMkdir);
  app.post('/fs/rename', { preHandler: resolveRepoAccess('write') }, postRename);
  app.post('/fs/upload', { preHandler: resolveRepoAccess('write') }, postUpload);
}
