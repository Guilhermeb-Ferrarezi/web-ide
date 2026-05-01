import 'fastify';
import '@fastify/session';
import type { AppRole } from '../modules/users/users.service.ts';

declare module 'fastify' {
  interface FastifyRequest {
    workspacePath?: string;
    repoId?: string;
    repoPermission?: 'read' | 'write';
  }
}

declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: {
      userId: string;
      githubUserId: string;
      login: string;
      name?: string;
      email?: string | null;
      accessToken: string;
      avatarUrl?: string;
      role: AppRole;
    };
  }
}
