import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GitFileList } from './GitFileList';

describe('<GitFileList />', () => {
  it('permite selecionar todos sem aninhar botão dentro de botão', async () => {
    const onToggleAll = vi.fn();

    render(
      <GitFileList
        title="Staged"
        items={[{ path: 'README.md', tag: 'M' }]}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={onToggleAll}
        emptyText="Nada"
      />,
    );

    await userEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos em Staged' }));

    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it('mostra dica curta para seleção em massa', () => {
    render(
      <GitFileList
        title="Staged"
        items={[{ path: 'README.md', tag: 'M' }]}
        selected={new Set()}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyText="Nada"
      />,
    );

    expect(screen.getByText('Marque para selecionar tudo')).toBeInTheDocument();
  });

  it('mostra progresso da seleção atual na lista', () => {
    render(
      <GitFileList
        title="Staged"
        items={[{ path: 'README.md', tag: 'M' }, { path: 'src/app.ts', tag: 'M' }]}
        selected={new Set(['README.md'])}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyText="Nada"
      />,
    );

    expect(screen.getByText('1 de 2 selecionados')).toBeInTheDocument();
  });

  it('conta apenas os selecionados que pertencem à lista atual', () => {
    render(
      <GitFileList
        title="Staged"
        items={[{ path: 'README.md', tag: 'M' }]}
        selected={new Set(['README.md', 'src/app.ts'])}
        onToggle={vi.fn()}
        onToggleAll={vi.fn()}
        emptyText="Nada"
      />,
    );

    expect(screen.getByText('1 de 1 selecionados')).toBeInTheDocument();
  });
});
