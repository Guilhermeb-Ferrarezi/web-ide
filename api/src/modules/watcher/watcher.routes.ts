import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { getRepoPermissionForUser } from '../permissions/permissions.service.ts';
import { findRepoBySlug } from '../repos/repo-catalog.service.ts';
import { subscribe } from './watcher.service.ts';

export default async function watcherRoutes(app: FastifyInstance) {
  app.get('/watcher', { websocket: true }, async (socket, req) => {
    const user = req.session.user;
    if (!user) {
      req.log.warn('[watcher] unauthenticated websocket connection');
      socket.send(JSON.stringify({ type: 'error', message: 'unauthenticated' }));
      socket.close();
      return;
    }

    const workspace = (req.query as { workspace?: string })?.workspace;
    if (!workspace) {
      req.log.warn({ userId: user.userId }, '[watcher] missing workspace');
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_required' }));
      socket.close();
      return;
    }

    const repo = await findRepoBySlug(workspace);
    if (!repo) {
      req.log.warn({ userId: user.userId, workspace }, '[watcher] repo not found');
      socket.send(JSON.stringify({ type: 'error', message: 'repo_not_found' }));
      socket.close();
      return;
    }
    const permission = await getRepoPermissionForUser(repo.id, user.userId);
    if (!permission) {
      req.log.warn({ userId: user.userId, workspace }, '[watcher] permission denied');
      socket.send(JSON.stringify({ type: 'error', message: 'permission_denied' }));
      socket.close();
      return;
    }
    const cwd = repo.storagePath;

    if (!fs.existsSync(cwd)) {
      req.log.warn({ userId: user.userId, workspace, cwd }, '[watcher] workspace path not found');
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_not_found' }));
      socket.close();
      return;
    }

    let unsubscribe: () => void;
    try {
      unsubscribe = subscribe(cwd, (event) => {
        if (socket.readyState !== socket.OPEN) return;
        try {
          socket.send(JSON.stringify(event));
        } catch {
          // ignore
        }
      });
    } catch (err) {
      req.log.error({ err, userId: user.userId, workspace, cwd }, '[watcher] failed to subscribe');
      socket.send(JSON.stringify({ type: 'error', message: 'watcher_subscribe_failed' }));
      socket.close();
      return;
    }

    req.log.info({ userId: user.userId, workspace, cwd }, '[watcher] subscribed');
    socket.send(JSON.stringify({ kind: 'ready' }));

    socket.on('close', (code, reason) => {
      req.log.info({ userId: user.userId, workspace, code, reason: reason.toString() }, '[watcher] socket closed');
      unsubscribe();
    });
    socket.on('error', (err) => {
      req.log.warn({ err, userId: user.userId, workspace }, '[watcher] socket error');
      unsubscribe();
    });
  });
}
