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
});
