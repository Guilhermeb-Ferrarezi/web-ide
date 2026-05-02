import { beforeEach, describe, expect, it, mock } from 'bun:test';

const findRepoBySlugMock = mock(async () => ({
  id: 'repo-1',
  storagePath: '/workspaces/repo-1',
}));

const getRepoPermissionForUserMock = mock(async () => 'write' as 'read' | 'write');

mock.restore();

mock.module('../modules/repos/repo-catalog.service.ts', () => ({
  findRepoBySlug: findRepoBySlugMock,
}));

mock.module('../modules/permissions/permissions.service.ts', () => ({
  getRepoPermissionForUser: getRepoPermissionForUserMock,
}));

const { resolveRepoAccess } = await import('./repo-access.middleware.ts');

describe('resolveRepoAccess', () => {
  beforeEach(() => {
    findRepoBySlugMock.mockClear();
    getRepoPermissionForUserMock.mockClear();
  });

  it('permite acesso de escrita quando a permissao do repo e write', async () => {
    const middleware = resolveRepoAccess('write');
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload: unknown) => payload),
    };

    const req = {
      session: { user: { userId: 'user-1' } },
      body: { workspace: 'repo-1' },
    } as any;

    await middleware(req, reply as never);

    expect(req.workspacePath).toBe('/workspaces/repo-1');
    expect(req.repoPermission).toBe('write');
    expect(reply.code).not.toHaveBeenCalled();
  });

  it('bloqueia acesso de escrita quando a permissao do repo e read', async () => {
    getRepoPermissionForUserMock.mockResolvedValueOnce('read' as const);

    const middleware = resolveRepoAccess('write');
    const reply = {
      code: mock((status: number) => reply),
      send: mock((payload: unknown) => payload),
    };

    const req = {
      session: { user: { userId: 'user-1' } },
      body: { workspace: 'repo-1' },
    } as any;

    await middleware(req, reply as never);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(req.workspacePath).toBeUndefined();
  });
});
