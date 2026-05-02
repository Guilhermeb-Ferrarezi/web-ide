import { render, screen, waitFor } from '@testing-library/react';
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
    fetchDiff: vi.fn().mockResolvedValue('diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old line\n+new line'),
    gitCommit: vi.fn().mockResolvedValue(undefined),
    gitUntrack: vi.fn().mockResolvedValue(undefined),
  };
});

describe('<GitPanel />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('desabilita acoes de escrita e explica o bloqueio em modo somente leitura', async () => {
    render(<GitPanel workspace="repo" readOnly />);

    await screen.findByRole('option', { name: 'develop' });

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

  it('mostra dicas de atalho para criar e limpar o commit', async () => {
    render(<GitPanel workspace="repo" />);

    await screen.findByRole('option', { name: 'develop' });

    expect(screen.getByText('Ctrl+Enter para commitar · Esc limpa a mensagem')).toBeInTheDocument();
  });

  it('mostra o diff do arquivo em foco com o preview automático', async () => {
    const fetchDiffSpy = vi.mocked(gitApi.fetchDiff);

    render(<GitPanel workspace="repo" />);

    await waitFor(() => expect(fetchDiffSpy).toHaveBeenCalledWith('repo', 'README.md', true));
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Alterado')).toBeInTheDocument();
    expect(screen.getByText('old line')).toBeInTheDocument();
    expect(screen.getByText('new line')).toBeInTheDocument();
  });

  it('só habilita commit quando existe mensagem', async () => {
    const user = userEvent.setup();

    render(<GitPanel workspace="repo" />);

    const commitButton = screen.getByRole('button', { name: 'Commit' });
    expect(commitButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Mensagem do commit'), 'feat: enable commit');

    expect(commitButton).toBeEnabled();
  });

  it('permite limpar a mensagem do commit com um botão dedicado', async () => {
    const user = userEvent.setup();

    render(<GitPanel workspace="repo" />);

    const textarea = screen.getByPlaceholderText('Mensagem do commit');
    await user.type(textarea, 'feat: clean me');
    await user.click(screen.getByRole('button', { name: 'Limpar mensagem do commit' }));

    expect(textarea).toHaveValue('');
    expect(textarea).toHaveFocus();
  });

  it('limpa a mensagem do commit ao pressionar Escape', async () => {
    const user = userEvent.setup();

    render(<GitPanel workspace="repo" />);

    const textarea = screen.getByPlaceholderText('Mensagem do commit');
    await user.type(textarea, 'feat: escape');
    await user.keyboard('{Escape}');

    expect(textarea).toHaveValue('');
    expect(textarea).toHaveFocus();
  });
});
