import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRepos } from './useRepos';
import * as reposApi from '@/api/repos';
import type { ReposPayload } from '@/types';

vi.mock('@/api/repos');
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

function makePayload(input: Partial<ReposPayload>): ReposPayload {
  return {
    githubRepos: [],
    localRepos: [],
    githubPagination: { page: 1, limit: 10, hasMore: false },
    localPagination: { page: 1, limit: 10, hasMore: false },
    ...input,
  };
}

describe('useRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca a primeira pagina ao montar', async () => {
    vi.spyOn(reposApi, 'listRepos').mockResolvedValue(makePayload({}));

    renderHook(() => useRepos());

    await waitFor(() =>
      expect(reposApi.listRepos).toHaveBeenCalledWith({
        githubPage: 1,
        localPage: 1,
        limit: 10,
      }),
    );
  });

  it('carrega mais repositorios do GitHub em append', async () => {
    vi.spyOn(reposApi, 'listRepos')
      .mockResolvedValueOnce(
        makePayload({
          githubRepos: Array.from({ length: 10 }, (_, index) => ({
            id: index + 1,
            name: `repo-${index + 1}`,
            fullName: `octocat/repo-${index + 1}`,
            private: false,
            cloneUrl: '',
            defaultBranch: 'main',
            updatedAt: null,
            description: null,
            language: null,
            cloned: false,
          })),
          githubPagination: { page: 1, limit: 10, hasMore: true },
        }),
      )
      .mockResolvedValueOnce(
        makePayload({
          githubRepos: Array.from({ length: 2 }, (_, index) => ({
            id: index + 11,
            name: `repo-${index + 11}`,
            fullName: `octocat/repo-${index + 11}`,
            private: false,
            cloneUrl: '',
            defaultBranch: 'main',
            updatedAt: null,
            description: null,
            language: null,
            cloned: false,
          })),
          githubPagination: { page: 2, limit: 10, hasMore: false },
        }),
      );

    const { result } = renderHook(() => useRepos());

    await waitFor(() => expect(result.current.githubRepos).toHaveLength(10));

    await act(async () => {
      await result.current.loadMoreGithub();
    });

    expect(reposApi.listRepos).toHaveBeenNthCalledWith(2, {
      githubPage: 2,
      localPage: 1,
      limit: 10,
    });
    expect(result.current.githubRepos).toHaveLength(12);
    expect(result.current.githubRepos.at(-1)?.name).toBe('repo-12');
  });

  it('mostra toast de loading enquanto importa e finaliza com sucesso', async () => {
    vi.spyOn(reposApi, 'listRepos').mockResolvedValue(makePayload({}));

    let resolveClone: ((value: any) => void) | null = null;
    vi.spyOn(reposApi, 'cloneRepo').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClone = resolve;
        }),
    );

    const { toast } = await import('sonner');
    vi.mocked(toast.loading).mockReturnValue('clone-toast');

    const { result } = renderHook(() => useRepos());
    await waitFor(() => expect(reposApi.listRepos).toHaveBeenCalled());

    const repo = {
      id: 1,
      name: 'repo-1',
      fullName: 'octocat/repo-1',
      private: false,
      cloneUrl: '',
      defaultBranch: 'main',
      updatedAt: null,
      description: null,
      language: null,
      cloned: false,
    };

    let clonePromise!: Promise<void>;
    act(() => {
      clonePromise = result.current.clone(repo);
    });

    await waitFor(() =>
      expect(toast.loading).toHaveBeenCalledWith('Importando repositório e instalando dependências...'),
    );

    resolveClone?.({
      repo: {
        id: 'local-1',
        slug: 'repo-1',
        githubFullName: 'octocat/repo-1',
        permission: 'write',
        path: '/tmp/repo-1',
        canManage: true,
      },
      permission: 'write',
    });

    await act(async () => {
      await clonePromise;
    });

    expect(toast.success).toHaveBeenCalledWith('repo-1 clonado', { id: 'clone-toast' });
  });
});
