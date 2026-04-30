import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { config } from '../config.ts';

export default fp(async (app) => {
  await app.register(cors, {
    origin: config.FRONTEND_URL,
    credentials: true,
  });
});
