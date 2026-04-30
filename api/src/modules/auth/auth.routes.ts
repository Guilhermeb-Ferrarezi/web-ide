import type { FastifyInstance } from 'fastify';
import { startGithubLogin, githubCallback, getMe, logout } from './auth.controller.ts';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/auth/github', startGithubLogin);
  app.get('/auth/github/callback', githubCallback);
  app.get('/auth/me', getMe);
  app.post('/auth/logout', logout);
}
