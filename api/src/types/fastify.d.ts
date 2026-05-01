import 'fastify';
import '@fastify/session';

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
      accessToken: string;
      avatarUrl?: string;
      role: 'owner' | 'admin' | 'user';
    };
  }
}
