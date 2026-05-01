import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { findRepoBySlug } from '../repos/repo-catalog.service.ts';
import { getRepoPermissionForUser } from '../permissions/permissions.service.ts';
import { parseTerminalClientMessage } from './terminal.protocol.ts';
import { createPty } from './terminal.service.ts';

export default async function terminalRoutes(app: FastifyInstance) {
  app.get('/terminal', { websocket: true }, async (socket, req) => {
    const user = req.session.user;
    if (!user) {
      req.log.warn('[terminal] unauthenticated websocket connection');
      socket.send(JSON.stringify({ type: 'error', message: 'unauthenticated' }));
      socket.close();
      return;
    }

    const workspace = (req.query as { workspace?: string })?.workspace;
    if (!workspace) {
      req.log.warn({ userId: user.userId }, '[terminal] missing workspace');
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_required' }));
      socket.close();
      return;
    }

    const repo = await findRepoBySlug(workspace);
    if (!repo) {
      req.log.warn({ userId: user.userId, workspace }, '[terminal] repo not found');
      socket.send(JSON.stringify({ type: 'error', message: 'repo_not_found' }));
      socket.close();
      return;
    }
    const permission = await getRepoPermissionForUser(repo.id, user.userId);
    if (permission !== 'write') {
      req.log.warn({ userId: user.userId, workspace }, '[terminal] permission denied');
      socket.send(JSON.stringify({ type: 'error', message: 'permission_denied' }));
      socket.close();
      return;
    }
    const cwd = repo.storagePath;

    if (!fs.existsSync(cwd)) {
      req.log.warn({ userId: user.userId, workspace, cwd }, '[terminal] workspace path not found');
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_not_found' }));
      socket.close();
      return;
    }

    req.log.info({ userId: user.userId, workspace, cwd }, '[terminal] spawning pty');
    let handle: ReturnType<typeof createPty>;
    try {
      handle = createPty(cwd, user.role);
    } catch (err) {
      req.log.error({ err, userId: user.userId, workspace, cwd }, '[terminal] failed to spawn pty');
      socket.send(JSON.stringify({ type: 'error', message: 'pty_spawn_failed' }));
      socket.close();
      return;
    }
    req.log.info({ userId: user.userId, workspace, pid: handle.pty.pid }, '[terminal] pty spawned');

    handle.pty.onData((data) => {
      try {
        socket.send(data);
      } catch (err) {
        req.log.warn({ err }, '[terminal] socket.send failed');
      }
    });

    handle.pty.onExit((info) => {
      req.log.info({ info }, '[terminal] pty exited');
      try {
        socket.close();
      } catch {
        // ignore
      }
    });

    socket.on('message', (raw: Buffer) => {
      const msg = raw.toString();
      const parsed = parseTerminalClientMessage(msg);
      if (parsed.type === 'resize') {
        handle.pty.resize(parsed.cols, parsed.rows);
        return;
      }
      if (parsed.type === 'input' || parsed.type === 'raw') {
        handle.pty.write(parsed.data);
        return;
      }
      if (parsed.type === 'ping') {
        try {
          socket.send(JSON.stringify({ type: 'pong' }));
        } catch {
          // ignore keepalive send failures
        }
      }
    });

    socket.on('close', (code: number, reason: Buffer) => {
      req.log.info({ userId: user.userId, workspace, code, reason: reason.toString() }, '[terminal] socket closed');
      handle.kill();
    });
    socket.on('error', (err: Error) => {
      req.log.warn({ err, userId: user.userId, workspace }, '[terminal] socket error');
      handle.kill();
    });
  });
}
