import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createPostChat } from './assistant.controller.ts';

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
});
