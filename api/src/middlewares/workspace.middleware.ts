import type { FastifyRequest, FastifyReply } from 'fastify';
import fs from 'node:fs';
import { config } from '../config.ts';
import { getWorkspacePath } from '../utils/path.utils.ts';

export async function resolveWorkspace(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });

  const ws =
    (req.query as { workspace?: string })?.workspace ??
    (req.body as { workspace?: string } | undefined)?.workspace;
  if (!ws) return reply.code(400).send({ error: 'workspace_required' });

  try {
    const target = getWorkspacePath(config.WORKSPACES_ROOT, user.userId, ws);
    if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
      return reply.code(404).send({ error: 'workspace_not_found' });
    }
    req.workspacePath = target;
  } catch {
    return reply.code(400).send({ error: 'invalid_workspace' });
  }
}
