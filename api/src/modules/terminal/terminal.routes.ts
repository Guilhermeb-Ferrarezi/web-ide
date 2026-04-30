import type { FastifyInstance } from 'fastify';
import { config } from '../../config.ts';
import { getWorkspacePath } from '../../utils/path.utils.ts';
import { createPty } from './terminal.service.ts';

export default async function terminalRoutes(app: FastifyInstance) {
  app.get('/terminal', { websocket: true }, (socket, req) => {
    const user = req.session.user;
    if (!user) {
      socket.send(JSON.stringify({ type: 'error', message: 'unauthenticated' }));
      socket.close();
      return;
    }

    const workspace = (req.query as { workspace?: string })?.workspace;
    if (!workspace) {
      socket.send(JSON.stringify({ type: 'error', message: 'workspace_required' }));
      socket.close();
      return;
    }

    let cwd: string;
    try {
      cwd = getWorkspacePath(config.WORKSPACES_ROOT, user.userId, workspace);
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid_workspace' }));
      socket.close();
      return;
    }

    const handle = createPty(cwd);

    handle.pty.onData((data) => {
      try {
        socket.send(data);
      } catch {
        // socket fechado
      }
    });

    handle.pty.onExit(() => {
      try {
        socket.close();
      } catch {
        // ignore
      }
    });

    socket.on('message', (raw) => {
      const msg = raw.toString();
      if (msg.startsWith('{')) {
        try {
          const parsed = JSON.parse(msg);
          if (parsed.type === 'resize') {
            handle.pty.resize(parsed.cols, parsed.rows);
            return;
          }
          if (parsed.type === 'input') {
            handle.pty.write(parsed.data);
            return;
          }
        } catch {
          // não é JSON — trata como input bruto
        }
      }
      handle.pty.write(msg);
    });

    socket.on('close', () => handle.kill());
    socket.on('error', () => handle.kill());
  });
}
