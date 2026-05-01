import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';
import { useAppearanceStore } from '@/stores/appearanceStore';
import type { ExtensionDetail } from '@/types';

const editorSpy = vi.fn();

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    editorSpy(props);
    return <div data-testid="monaco-editor" />;
  },
  useMonaco: () => null,
}));

describe('<EditorPane />', () => {
  it('passa o editor como readOnly quando a workspace nao tem permissao de escrita', () => {
    render(
      <EditorPane
        tab={{
          path: 'README.md',
          name: 'README.md',
          content: '# docs',
          originalContent: '# docs',
          encoding: 'utf-8',
          mimeType: 'text/markdown',
          dirty: false,
        }}
        readOnly
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(editorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ readOnly: true, fixedOverflowWidgets: true }),
      }),
    );
  });

  it('usa o tema ativo configurado na appearance store', () => {
    useAppearanceStore.setState({
      installedThemes: [
        {
          id: 'github.github-vscode-theme-dark',
          extensionId: 'GitHub.github-vscode-theme',
          label: 'GitHub Dark',
          uiTheme: 'vs-dark',
          colors: { 'editor.background': '#0d1117' },
          rules: [],
        },
      ],
      activeThemeId: 'github.github-vscode-theme-dark',
      installedIconThemes: [],
      activeIconThemeId: 'material-default',
    });

    render(
      <EditorPane
        tab={{
          path: 'README.md',
          name: 'README.md',
          content: '# docs',
          originalContent: '# docs',
          encoding: 'utf-8',
          mimeType: 'text/markdown',
          dirty: false,
        }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(editorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'github.github-vscode-theme-dark',
      }),
    );
  });

  it('renderiza detalhe de extensao como view customizada em vez do Monaco', () => {
    const extensionDetail: ExtensionDetail = {
      extension: {
        id: 'DaltonMenezes.aura-theme',
        name: 'aura-theme',
        namespace: 'DaltonMenezes',
        displayName: 'Aura Theme',
        description: 'A beautiful dark theme for Visual Studio Code',
        version: '2.1.2',
        iconUrl: 'https://example.com/aura.png',
        downloadCount: 100,
        averageRating: 5,
        verified: true,
      },
      readme: '<p align="center"><img src="https://example.com/banner.png" alt="Aura Banner" /></p>\n\n# Aura Theme\n\nA beautiful dark theme for Visual Studio Code',
      resources: [{ label: 'Repository', url: 'https://github.com/daltonmenezes/aura-theme' }],
      categories: ['Themes'],
      publishedAt: '2024-10-04T03:33:27.439016Z',
      updatedAt: '2024-10-04T03:33:27.439016Z',
    };

    render(
      <EditorPane
        tab={{
          path: 'Extensions/Aura Theme',
          name: 'Extension: Aura Theme',
          content: extensionDetail.readme ?? '',
          originalContent: extensionDetail.readme ?? '',
          encoding: 'utf-8',
          mimeType: 'application/x-web-ide-extension',
          dirty: false,
          kind: 'extension',
          iconUrl: extensionDetail.extension.iconUrl,
          extensionDetail,
        }}
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Aura Theme' })).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByAltText('Aura Banner')).toBeInTheDocument();
    expect(screen.queryByText('<p align="center">')).not.toBeInTheDocument();
    expect(screen.queryByTestId('monaco-editor')).not.toBeInTheDocument();
  });
});
