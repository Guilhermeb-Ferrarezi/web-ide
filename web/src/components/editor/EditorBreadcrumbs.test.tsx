import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('resume segmentos ocultos quando o caminho é longo', () => {
    render(<EditorBreadcrumbs path="apps/web/src/components/layout/StatusBar.tsx" />);

    expect(screen.getByText('apps')).toBeInTheDocument();
    expect(screen.getByText('StatusBar.tsx')).toBeInTheDocument();
    expect(screen.getByTitle('web / src / components / layout')).toHaveTextContent('…');
  });

  it('expande os segmentos ocultos ao clicar nas reticências', async () => {
    const user = userEvent.setup();

    render(<EditorBreadcrumbs path="apps/web/src/components/layout/StatusBar.tsx" />);

    await user.click(screen.getByRole('button', { name: 'Mostrar pastas intermediárias' }));

    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar pastas intermediárias' })).not.toBeInTheDocument();
  });

  it('expande os segmentos ocultos com Enter', async () => {
    const user = userEvent.setup();

    render(<EditorBreadcrumbs path="apps/web/src/components/layout/StatusBar.tsx" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByText('layout')).toBeInTheDocument();
  });

  it('expande os segmentos ocultos com Space', async () => {
    const user = userEvent.setup();

    render(<EditorBreadcrumbs path="apps/web/src/components/layout/StatusBar.tsx" />);

    await user.tab();
    await user.keyboard(' ');

    expect(screen.getByText('src')).toBeInTheDocument();
    expect(screen.getByText('components')).toBeInTheDocument();
  });

  it('mantém o foco nas reticências antes da expansão manual', async () => {
    const user = userEvent.setup();

    render(<EditorBreadcrumbs path="apps/web/src/components/layout/StatusBar.tsx" />);

    await user.tab();

    expect(screen.getByRole('button', { name: 'Mostrar pastas intermediárias' })).toHaveFocus();
  });

  it('nao renderiza nada sem path ativo', () => {
    const { container } = render(<EditorBreadcrumbs path={null} />);
    expect(container.firstChild).toBeNull();
  });
});
