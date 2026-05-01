import { beforeEach, describe, expect, it, mock } from 'bun:test';

const listReposForUserMock = mock(async () => ({
  githubRepos: [],
  localRepos: [],
  githubPagination: { page: 2, limit: 10, hasMore: true },
  localPagination: { page: 3, limit: 10, hasMore: false },
}));

mock.module('./repos.service.ts', () => ({
  listReposForUser: listReposForUserMock,
  listLocalRepos: mock(async () => []),
  importRepo: mock(async () => ({ repo: null, permission: 'read' })),
  deleteLocalRepo: mock(async () => {}),
}));

const { getRemoteRepos } = await import('./repos.controller.ts');

describe('getRemoteRepos', () => {
  beforeEach(() => {
    listReposForUserMock.mockClear();
  });

  it('encaminha a paginacao pedida para a service', async () => {
    const reply = {
      send: mock((payload: unknown) => payload),
    };

    await getRemoteRepos(
      {
        session: {
          user: {
            accessToken: 'token-1',
            userId: 'user-1',
          },
        },
        query: {
          githubPage: '2',
          localPage: '3',
          limit: '10',
        },
      } as any,
      reply as any,
    );

    expect(listReposForUserMock).toHaveBeenCalledTimes(1);
    expect(listReposForUserMock.mock.calls[0] as any).toEqual([
      'token-1',
      'user-1',
      { githubPage: 2, localPage: 3, limit: 10 },
    ]);
  });
});
