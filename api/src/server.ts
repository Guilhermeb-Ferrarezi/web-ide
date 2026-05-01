import Fastify from 'fastify';
import { config } from './config.ts';
import cookiePlugin from './plugins/cookie.ts';
import sessionPlugin from './plugins/session.ts';
import corsPlugin from './plugins/cors.ts';
import websocketPlugin from './plugins/websocket.ts';
import authRoutes from './modules/auth/auth.routes.ts';
import reposRoutes from './modules/repos/repos.routes.ts';
import fsRoutes from './modules/fs/fs.routes.ts';
import gitRoutes from './modules/git/git.routes.ts';
import terminalRoutes from './modules/terminal/terminal.routes.ts';
import watcherRoutes from './modules/watcher/watcher.routes.ts';
import { runMigrations } from './db/run-migrations.ts';
import permissionsRoutes from './modules/permissions/permissions.routes.ts';
import adminRoutes from './modules/admin/admin.routes.ts';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
  },
});

if (config.NODE_ENV === 'development') {
  await runMigrations();
}

await app.register(cookiePlugin);
await app.register(sessionPlugin);
await app.register(corsPlugin);
await app.register(websocketPlugin);

app.get('/health', async () => ({ status: 'ok' }));

await app.register(
  async (api) => {
    await api.register(authRoutes);
    await api.register(reposRoutes);
    await api.register(fsRoutes);
    await api.register(gitRoutes);
    await api.register(terminalRoutes);
    await api.register(watcherRoutes);
    await api.register(permissionsRoutes);
    await api.register(adminRoutes);
  },
  { prefix: '/api' },
);

try {
  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`API listening on http://${config.HOST}:${config.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
