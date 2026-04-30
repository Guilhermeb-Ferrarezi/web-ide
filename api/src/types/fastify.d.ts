import 'fastify';
import '@fastify/session';

declare module 'fastify' {
  interface FastifyRequest {
    workspacePath?: string;
  }
}

declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: {
      userId: string;
      login: string;
      accessToken: string;
      avatarUrl?: string;
    };
  }
}
