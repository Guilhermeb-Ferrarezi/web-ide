import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExtensionDetailView } from './ExtensionDetailView';
import type { ExtensionDetail } from '@/types';

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const detail: ExtensionDetail = {
  extension: {
    id: 'GitHub.github-vscode-theme',
    name: 'github-vscode-theme',
    namespace: 'GitHub',
    displayName: 'GitHub Theme',
    description: 'GitHub theme for VS Code',
    version: '6.3.5',
    iconUrl: 'https://example.com/icon.png',
    downloadCount: 123456,
    averageRating: 5,
    verified: true,
  },
  readme: '# GitHub Theme\n\nA beautiful dark theme for Visual Studio Code',
  resources: [
    { label: 'Repository', url: 'https://github.com/github/github-vscode-theme' },
  ],
  categories: ['Themes'],
  publishedAt: '2024-10-04T03:33:27.439016Z',
  updatedAt: '2024-10-04T03:33:27.439016Z',
  installSupport: {
    supported: true,
    kinds: ['theme'],
    reason: null,
  },
};

describe('<ExtensionDetailView />', () => {
  it('mostra um resumo curto das ações principais', () => {
    render(
      <ExtensionDetailView
        detail={detail}
        installing={false}
        canInstall
        installedAction={null}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('Instalar para usar no editor')).toBeInTheDocument();
    expect(screen.getByText('Leia o resumo ou abra recursos externos abaixo')).toBeInTheDocument();
  });

  it('resume a quantidade de recursos externos no cabeçalho', () => {
    render(
      <ExtensionDetailView
        detail={detail}
        installing={false}
        canInstall
        installedAction={null}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('1 recurso externo')).toBeInTheDocument();
  });

  it('mostra estado vazio quando não há recursos externos', () => {
    render(
      <ExtensionDetailView
        detail={{ ...detail, resources: [] }}
        installing={false}
        canInstall
        installedAction={null}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText('Nenhum recurso externo disponível.')).toBeInTheDocument();
  });

  it('expõe ações para um tema instalado', async () => {
    const onApply = vi.fn();
    const onDeactivate = vi.fn();
    const onDelete = vi.fn();

    render(
      <ExtensionDetailView
        detail={detail}
        installing={false}
        canInstall={false}
        installedAction={{
          applyLabel: 'Set Color Theme',
          onApply,
          active: false,
          onDeactivate,
          onDelete,
          deleting: false,
        }}
        onInstall={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Set Color Theme' }));
    await userEvent.click(screen.getByRole('button', { name: 'Excluir tema' }));

    expect(screen.getByRole('button', { name: 'Desativar' })).toBeDisabled();
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
