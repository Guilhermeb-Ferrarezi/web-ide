import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GitPanel } from './GitPanel';
import * as gitApi from '@/api/git';

vi.mock('@/hooks/useGitStatus', () => ({
  useGitStatus: () => ({
    status: {
      branch: 'main',
      ahead: 0,
      behind: 0,
      staged: [{ path: 'README.md', index: 'M', workingDir: ' ' }],
      unstaged: [{ path: 'src/app.ts', index: ' ', workingDir: 'M' }],
      untracked: [],
    },
    loading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/api/git', async () => {
  const actual = await vi.importActual<typeof import('@/api/git')>('@/api/git');
  return {
    ...actual,
    fetchBranches: vi.fn().mockResolvedValue({ current: 'main', all: ['main', 'develop'] }),
    gitCommit: vi.fn().mockResolvedValue(undefined),
    gitUntrack: vi.fn().mockResolvedValue(undefined),
  };
});

describe('<GitPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('desabilita acoes de escrita e explica o bloqueio em modo somente leitura', () => {
    render(<GitPanel workspace="repo" readOnly />);

    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.getByText('Commits, stage, push e pull ficam bloqueados para quem tem acesso read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar selecionados/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Push/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pull/i })).toBeDisabled();
  });

  it('permite tirar arquivos rastreados do git pelos selecionados', async () => {
    const user = userEvent.setup();
    const untrackSpy = vi.mocked(gitApi.gitUntrack);

    render(<GitPanel workspace="repo" />);

    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByRole('button', { name: 'Tirar selecionados do Git' }));

    expect(untrackSpy).toHaveBeenCalledWith('repo', ['README.md']);
  });

  it('permite escolher a branch do commit', async () => {
    const user = userEvent.setup();
    const commitSpy = vi.mocked(gitApi.gitCommit);

    render(<GitPanel workspace="repo" />);

    await screen.findByRole('option', { name: 'develop' });
    await user.selectOptions(screen.getByLabelText('Branch do commit'), 'develop');
    await user.type(screen.getByPlaceholderText('Mensagem do commit'), 'feat: branch target');
    await user.click(screen.getByRole('button', { name: 'Commit' }));

    expect(commitSpy).toHaveBeenCalledWith('repo', 'feat: branch target', 'develop');
  });
});
