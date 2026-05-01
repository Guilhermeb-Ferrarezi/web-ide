import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EditorTabs } from './EditorTabs';

describe('<EditorTabs />', () => {
  it('renderiza o icone do arquivo ao lado do nome da aba', () => {
    render(
      <EditorTabs
        tabs={[
          {
            path: 'src/components/FileTree.tsx',
            name: 'FileTree.tsx',
            content: '',
            originalContent: '',
            encoding: 'utf-8',
            mimeType: 'text/plain',
            dirty: false,
          },
        ]}
        activePath="src/components/FileTree.tsx"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('FileTree.tsx')).toBeInTheDocument();
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v5.34.0/icons/react_ts.svg',
    );
  });

  it('seleciona e fecha abas sem conflitar com o clique no botao de fechar', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <EditorTabs
        tabs={[
          {
            path: 'README.md',
            name: 'README.md',
            content: '',
            originalContent: '',
            encoding: 'utf-8',
            mimeType: 'text/markdown',
            dirty: true,
          },
        ]}
        activePath="README.md"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fechar README.md' }));
    expect(onClose).toHaveBeenCalledWith('README.md');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
