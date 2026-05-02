import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReposPage from './ReposPage';
import * as reposApi from '@/api/repos';
import type { LocalRepo } from '@/types';

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
      loadingMoreGithub: false,
      loadingMoreLocal: false,
      hasMoreGithub: false,
      hasMoreLocal: false,
      cloningId: null,
      loadMoreGithub: vi.fn(),
      loadMoreLocal: vi.fn(),
      init: vi.fn(),
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

  it('permite alterar a permissao de um usuario ja compartilhado', async () => {
    vi.spyOn(reposApi, 'listRepoPermissions')
      .mockResolvedValueOnce([
        { userId: 'user-2', login: 'octodemo', permission: 'read' },
      ])
      .mockResolvedValueOnce([
        { userId: 'user-2', login: 'octodemo', permission: 'write' },
      ]);
    const grantSpy = vi.spyOn(reposApi, 'grantRepoAccess').mockResolvedValue();

    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: /compartilhar/i }));
    expect(await screen.findByText('@octodemo')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Permissão de octodemo'), 'write');

    await waitFor(() =>
      expect(grantSpy).toHaveBeenCalledWith('repo-1', 'octodemo', 'write'),
    );
    expect(screen.getByLabelText('Permissão de octodemo')).toHaveValue('write');
  });

  it('aciona o carregamento da proxima pagina do GitHub ao atingir o fim da lista', async () => {
    const loadMoreGithub = vi.fn();
    mockUseRepos.mockReturnValue({
      githubRepos: [
        {
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
        },
      ],
      localRepos: [],
      loading: false,
      loadingMoreGithub: false,
      loadingMoreLocal: false,
      hasMoreGithub: true,
      hasMoreLocal: false,
      cloningId: null,
      loadMoreGithub,
      loadMoreLocal: vi.fn(),
      init: vi.fn(),
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

    act(() => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await waitFor(() => expect(loadMoreGithub).toHaveBeenCalledTimes(1));
  });

  it('permite escolher a branch antes de importar um repositorio do GitHub', async () => {
    const clone = vi.fn().mockResolvedValue(undefined);
    mockUseRepos.mockReturnValue({
      githubRepos: [
        {
          id: 42,
          name: 'repo-branch',
          fullName: 'octocat/repo-branch',
          private: false,
          cloneUrl: '',
          defaultBranch: 'main',
          updatedAt: null,
          description: null,
          language: 'TypeScript',
          cloned: false,
        },
      ],
      localRepos: [],
      loading: false,
      loadingMoreGithub: false,
      loadingMoreLocal: false,
      hasMoreGithub: false,
      hasMoreLocal: false,
      cloningId: null,
      loadMoreGithub: vi.fn(),
      loadMoreLocal: vi.fn(),
      init: vi.fn(),
      clone,
      remove: vi.fn(),
    });
    vi.spyOn(reposApi, 'listRepoPermissions').mockResolvedValue([]);
    vi.spyOn(reposApi, 'listRepoBranches').mockResolvedValue(['main', 'develop', 'release']);

    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    await screen.findByRole('option', { name: 'develop' });
    await userEvent.selectOptions(screen.getByLabelText('Branch para importar octocat/repo-branch'), 'develop');
    await userEvent.click(screen.getByRole('button', { name: 'Importar' }));

    expect(clone).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'octocat/repo-branch' }),
      'develop',
    );
  });

  it('mostra um botão para limpar a busca de repositórios', async () => {
    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('Buscar repositório...');
    await userEvent.type(input, 'my-repo');
    expect(input).toHaveValue('my-repo');

    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca de repositórios' }));

    expect(input).toHaveValue('');
  });

  it('mostra um aviso contextual quando a busca não encontra repositórios', async () => {
    render(
      <MemoryRouter>
        <ReposPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText('Buscar repositório...'), 'sem-match');

    expect(screen.getByText('Nenhum repositório corresponde a “sem-match”.')).toBeInTheDocument();
    expect(screen.getByText('Use Esc ou o botão limpar para buscar novamente.')).toBeInTheDocument();
  });
});
