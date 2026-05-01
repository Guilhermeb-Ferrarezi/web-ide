import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReposPage from './ReposPage';
import * as reposApi from '@/api/repos';
import type { LocalRepo, RemoteRepo } from '@/types';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockUseRepos = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      userId: 'user-1',
      login: 'octocat',
      avatarUrl: 'https://example.com/me.png',
      role: 'owner',
    },
    logout: mockLogout,
  }),
}));

vi.mock('@/hooks/useRepos', () => ({
  useRepos: () => mockUseRepos(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

describe('<ReposPage />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRepos.mockReturnValue({
      githubRepos: [],
      localRepos: [
        {
          id: 'repo-1',
          slug: 'my-repo',
          githubFullName: 'octocat/my-repo',
          permission: 'write',
          path: '/tmp/my-repo',
          canManage: true,
        },
      ] satisfies LocalRepo[],
      loading: false,
      cloningId: null,
      clone: vi.fn(),
      remove: vi.fn(),
    });
  });

  it('mostra sugestoes de usuarios do banco com avatar ao pesquisar login do GitHub', async () => {
    vi.spyOn(reposApi, 'listRepoPermissions').mockResolvedValue([]);
    vi.spyOn(reposApi, 'searchShareUsers').mockResolvedValue([
      {
        userId: 'user-2',
        login: 'octodemo',
        avatarUrl: 'https://example.com/octodemo.png',
      },
    ]);

    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /compartilhar/i }));
    await userEvent.type(screen.getByPlaceholderText('login do GitHub'), 'octo');

    expect(await screen.findByText('@octodemo')).toBeInTheDocument();
    expect(screen.getByAltText('octodemo')).toHaveAttribute('src', 'https://example.com/octodemo.png');
    await waitFor(() =>
      expect(reposApi.searchShareUsers).toHaveBeenCalledWith('repo-1', 'octo'),
    );
  });

  it('carrega repositorios do GitHub em blocos de 10 ao atingir o fim da lista', async () => {
    const githubRepos = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `repo-${index + 1}`,
      fullName: `octocat/repo-${index + 1}`,
      private: false,
      cloneUrl: `https://github.com/octocat/repo-${index + 1}.git`,
      defaultBranch: 'main',
      updatedAt: '2026-04-30T00:00:00.000Z',
      description: null,
      language: 'TypeScript',
      cloned: false,
    })) satisfies RemoteRepo[];

    mockUseRepos.mockReturnValue({
      githubRepos,
      localRepos: [],
      loading: false,
      cloningId: null,
      clone: vi.fn(),
      remove: vi.fn(),
    });

    let observerCallback: IntersectionObserverCallback | null = null;
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);

    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('repo-1')).toBeInTheDocument();
    expect(screen.getByText('repo-10')).toBeInTheDocument();
    expect(screen.queryByText('repo-11')).not.toBeInTheDocument();

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => expect(screen.getByText('repo-20')).toBeInTheDocument());
    expect(screen.queryByText('repo-21')).not.toBeInTheDocument();

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => expect(screen.getByText('repo-25')).toBeInTheDocument());
  });
});
