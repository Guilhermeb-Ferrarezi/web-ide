import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GitPanel } from './GitPanel';

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

describe('<GitPanel />', () => {
  it('desabilita acoes de escrita e explica o bloqueio em modo somente leitura', () => {
    render(<GitPanel workspace="repo" readOnly />);

    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.getByText('Commits, stage, push e pull ficam bloqueados para quem tem acesso read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar selecionados/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Commit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Push/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Pull/i })).toBeDisabled();
  });
});
