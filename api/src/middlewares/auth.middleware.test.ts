import { describe, it, expect, mock } from 'bun:test';
import { requireAuth } from './auth.middleware.ts';

function makeReply() {
  const reply: any = {
    statusCode: 0,
    body: undefined,
    code(c: number) {
      reply.statusCode = c;
      return reply;
    },
    send(payload: unknown) {
      reply.body = payload;
      return reply;
    },
  };
  reply.code = mock(reply.code);
  reply.send = mock(reply.send);
  return reply;
}

describe('requireAuth', () => {
  it('retorna 401 quando não há sessão de usuário', async () => {
    const req = { session: {} } as any;
    const reply = makeReply();
    await requireAuth(req, reply);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.body).toEqual({ error: 'unauthenticated' });
  });

  it('passa silenciosamente quando há usuário', async () => {
    const req = { session: { user: { userId: '1', login: 'a', accessToken: 't' } } } as any;
    const reply = makeReply();
    const result = await requireAuth(req, reply);
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
