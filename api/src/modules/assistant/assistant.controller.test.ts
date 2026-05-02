import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createPostChat } from './assistant.controller.ts';
import { AssistantAuthError, AssistantTimeoutError } from './assistant.service.ts';

const chatWithAssistantMock = mock(async () => ({
  message: 'Resposta do assistente',
  model: 'test-model',
}));

const postChat = createPostChat(chatWithAssistantMock as never);

describe('postChat', () => {
  beforeEach(() => {
    chatWithAssistantMock.mockClear();
  });

  it('bloqueia acesso sem sessao ativa', async () => {
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload: unknown) => payload),
    };

    await postChat(
      {
        session: {},
        body: {
          workspace: 'repo',
          messages: [{ role: 'user', content: 'oi' }],
        },
      } as any,
      reply as any,
    );

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(chatWithAssistantMock).not.toHaveBeenCalled();
  });

  it('encaminha o payload validado para o service', async () => {
    const reply = {
      send: mock((payload: unknown) => payload),
    };

    await postChat(
      {
        session: {
          user: {
            userId: '1',
            login: 'octocat',
          },
        },
        workspacePath: '/workspaces/octocat/repo',
        body: {
          workspace: 'repo',
          activePath: 'src/app.ts',
          activeContent: 'const value = 1;',
          messages: [{ role: 'user', content: 'Explique isso' }],
        },
      } as any,
      reply as any,
    );

    expect(chatWithAssistantMock).toHaveBeenCalledTimes(1);
    const payload = chatWithAssistantMock.mock.calls[0] as unknown as [
      {
        workspace: string;
        workspacePath: string;
        activePath?: string | null;
        activeContent?: string | null;
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      },
    ];
    expect(payload[0]).toEqual({
      workspace: 'repo',
      workspacePath: '/workspaces/octocat/repo',
      activePath: 'src/app.ts',
      activeContent: 'const value = 1;',
      messages: [{ role: 'user', content: 'Explique isso' }],
    });
  });

  it('retorna 504 quando o codex excede o tempo limite', async () => {
    const timeoutChat = createPostChat(async () => {
      throw new AssistantTimeoutError();
    });
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload: unknown) => payload),
    };

    await timeoutChat(
      {
        session: {
          user: {
            userId: '1',
            login: 'octocat',
          },
        },
        workspacePath: '/workspaces/octocat/repo',
        body: {
          workspace: 'repo',
          messages: [{ role: 'user', content: 'oi' }],
        },
      } as any,
      reply as any,
    );

    expect(reply.code).toHaveBeenCalledWith(504);
  });

  it('retorna 503 quando o codex nao esta autenticado', async () => {
    const authChat = createPostChat(async () => {
      throw new AssistantAuthError();
    });
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload: unknown) => payload),
    };

    await authChat(
      {
        session: {
          user: {
            userId: '1',
            login: 'octocat',
          },
        },
        workspacePath: '/workspaces/octocat/repo',
        body: {
          workspace: 'repo',
          messages: [{ role: 'user', content: 'oi' }],
        },
      } as any,
      reply as any,
    );

    expect(reply.code).toHaveBeenCalledWith(503);
  });
});
