import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TerminalPane } from './TerminalPane';

const useTerminalSpy = vi.fn();

vi.mock('@/hooks/useTerminal', () => ({
  useTerminal: (...args: unknown[]) => useTerminalSpy(...args),
}));

describe('<TerminalPane />', () => {
  it('expõe um rótulo acessível para a região do terminal', () => {
    render(<TerminalPane workspace="repo" />);

    expect(screen.getByRole('region', { name: 'Terminal do workspace repo' })).toBeInTheDocument();
  });

  it('mostra uma dica de atalho para foco', () => {
    render(<TerminalPane workspace="repo" />);

    expect(screen.getByText('Ctrl+` para focar o terminal')).toBeInTheDocument();
  });

  it('mostra um rótulo curto com o nome do workspace', () => {
    render(<TerminalPane workspace="repo" />);

    expect(screen.getByText('Terminal · repo')).toBeInTheDocument();
  });
});
