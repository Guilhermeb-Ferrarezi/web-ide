import type { FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'node:crypto';
import { config } from '../../config.ts';
import { ensureUserFromGithubProfile, getGlobalRoleForUser, resolveAppRole } from '../users/users.service.ts';
import { buildAuthorizeUrl, exchangeCodeForToken, fetchGithubUser } from './auth.service.ts';

export async function startGithubLogin(req: FastifyRequest, reply: FastifyReply) {
  const state = crypto.randomBytes(16).toString('hex');
  (req.session as any).oauthState = state;
  await req.session.save();
  return reply.redirect(buildAuthorizeUrl(state));
}

export async function githubCallback(
  req: FastifyRequest<{ Querystring: { code?: string; state?: string; error?: string } }>,
  reply: FastifyReply,
) {
  const { code, state, error } = req.query;
  const expectedState = (req.session as any).oauthState as string | undefined;

  if (error) {
    return reply.redirect(`${config.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state || state !== expectedState) {
    return reply.redirect(`${config.FRONTEND_URL}/login?error=invalid_state`);
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const user = await fetchGithubUser(accessToken);
    const localUser = await ensureUserFromGithubProfile({
      githubUserId: user.userId,
      login: user.login,
      avatarUrl: user.avatarUrl,
      accessToken,
    });
    const storedRole = await getGlobalRoleForUser(localUser.id);
    const role = resolveAppRole(storedRole, {
      userId: localUser.id,
      githubUserId: user.userId,
      login: user.login,
      terminalSuperusers: config.TERMINAL_SUPERUSERS_LIST,
    });

    req.session.user = {
      userId: localUser.id,
      githubUserId: user.userId,
      login: user.login,
      name: user.name,
      email: user.email,
      accessToken,
      avatarUrl: user.avatarUrl,
      role,
    };
    delete (req.session as any).oauthState;
    await req.session.save();

    return reply.redirect(`${config.FRONTEND_URL}/repos`);
  } catch (err) {
    req.log.error({ err }, 'GitHub OAuth callback failed');
    return reply.redirect(`${config.FRONTEND_URL}/login?error=oauth_failed`);
  }
}

export async function getMe(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  return {
    userId: user.userId,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

export async function logout(req: FastifyRequest, reply: FastifyReply) {
  await req.session.destroy();
  return reply.send({ ok: true });
}
