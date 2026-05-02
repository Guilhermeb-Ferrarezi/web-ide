import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { findRepoBySlug } from '../repos/repo-catalog.service.ts';
import { getRepoPermissionForUser } from '../permissions/permissions.service.ts';
import { resolveCurrentAppRole } from '../users/users.service.ts';
import { parseTerminalClientMessage } from './terminal.protocol.ts';
import { createPty } from './terminal.service.ts';
import { getOrCreateTerminalSession, type TerminalSession } from './terminal.sessions.ts';

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
    const role = await resolveCurrentAppRole({
      userId: user.userId,
      githubUserId: user.githubUserId,
      login: user.login,
    });
    req.session.user = {
      ...user,
      role,
    };
    await req.session.save();

    if (!fs.existsSync(cwd)) {
      req.log.warn({ userId: user.userId, workspace, cwd }, '[terminal] workspace path not found');
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_not_found' }));
      socket.close();
      return;
    }

    req.log.info({ userId: user.userId, workspace, cwd }, '[terminal] attaching session');
    let session: TerminalSession | undefined;
    try {
      session = getOrCreateTerminalSession(user.userId, workspace, cwd, role, {
        createPty,
        onExit: (info) => {
          req.log.info(
            { userId: user.userId, workspace, cwd, pid: session?.handle.pty.pid, ...info },
            '[terminal] pty exited',
          );
        },
      });
    } catch (err) {
      req.log.error({ err, userId: user.userId, workspace, cwd }, '[terminal] failed to spawn pty');
      socket.send(JSON.stringify({ type: 'error', message: 'pty_spawn_failed' }));
      socket.close();
      return;
    }
    req.log.info({ userId: user.userId, workspace, pid: session.handle.pty.pid }, '[terminal] pty ready');

    session.attachSocket(socket);

    socket.on('message', (raw: Buffer) => {
      if (session.socket !== socket) return;
      const msg = raw.toString();
      const parsed = parseTerminalClientMessage(msg);
      if (parsed.type === 'resize') {
        session.handle.pty.resize(parsed.cols, parsed.rows);
        return;
      }
      if (parsed.type === 'input' || parsed.type === 'raw') {
        session.handle.pty.write(parsed.data);
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
      session.detachSocket(socket);
    });
    socket.on('error', (err: Error) => {
      req.log.warn({ err, userId: user.userId, workspace }, '[terminal] socket error');
      session.detachSocket(socket);
    });
  });
}
