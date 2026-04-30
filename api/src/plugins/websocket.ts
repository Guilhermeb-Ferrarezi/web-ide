import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

export default fp(async (app) => {
  await app.register(websocket);
});
