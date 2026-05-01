import type { FastifyReply, FastifyRequest } from 'fastify';
import { findRepoBySlug } from '../modules/repos/repo-catalog.service.ts';
import { getRepoPermissionForUser } from '../modules/permissions/permissions.service.ts';

export function resolveRepoAccess(required: 'read' | 'write') {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const user = req.session.user;
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });

    const slug =
      (req.query as { workspace?: string })?.workspace ??
      (req.body as { workspace?: string } | undefined)?.workspace;
    if (!slug) return reply.code(400).send({ error: 'workspace_required' });

    const repo = await findRepoBySlug(slug);
    if (!repo) return reply.code(404).send({ error: 'repo_not_found' });

    const permission = await getRepoPermissionForUser(repo.id, user.userId);
    if (!permission) return reply.code(403).send({ error: 'permission_denied' });
    if (required === 'write' && permission !== 'write') {
      return reply.code(403).send({ error: 'permission_denied' });
    }

    req.workspacePath = repo.storagePath;
    req.repoId = repo.id;
    req.repoPermission = permission;
  };
}
