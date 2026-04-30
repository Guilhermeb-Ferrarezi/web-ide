import fp from 'fastify-plugin';
import session from '@fastify/session';
import { config } from '../config.ts';

export default fp(async (app) => {
  await app.register(session, {
    secret: config.SESSION_SECRET,
    cookieName: 'web_ide_session',
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    saveUninitialized: false,
  });
});
