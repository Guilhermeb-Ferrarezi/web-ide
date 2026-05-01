import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EditorBreadcrumbs } from './EditorBreadcrumbs';

describe('<EditorBreadcrumbs />', () => {
  it('renderiza segmentos de pasta com icones e o arquivo ativo no final', () => {
    render(<EditorBreadcrumbs path="src/components/FileTree.tsx" dirty />);

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.getByText('FileTree.tsx')).toBeInTheDocument();
    expect(screen.getByLabelText('Arquivo com alteracoes nao salvas')).toBeInTheDocument();

    const images = screen.getAllByRole('presentation');
    expect(images).toHaveLength(3);
    expect(images[0]).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v5.34.0/icons/folder-src.svg',
    );
    expect(images[2]).toHaveAttribute(
      'src',
      'https://raw.githubusercontent.com/material-extensions/vscode-material-icon-theme/v5.34.0/icons/react_ts.svg',
    );
  });

  it('nao renderiza nada sem path ativo', () => {
    const { container } = render(<EditorBreadcrumbs path={null} />);
    expect(container.firstChild).toBeNull();
  });
});
