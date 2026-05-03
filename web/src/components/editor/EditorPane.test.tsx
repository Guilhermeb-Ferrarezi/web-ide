import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';
import { useAppearanceStore } from '@/stores/appearanceStore';
import type { ExtensionDetail } from '@/types';

const editorSpy = vi.fn();
const defineThemeSpy = vi.fn();
let monacoMock: { editor: { defineTheme: typeof defineThemeSpy } } | null = null;

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    editorSpy(props);
    return <div data-testid="monaco-editor" />;
  },
  useMonaco: () => monacoMock,
}));

describe('<EditorPane />', () => {
  beforeEach(() => {
    editorSpy.mockReset();
    defineThemeSpy.mockReset();
    monacoMock = null;
  });

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
        options: expect.objectContaining({
          readOnly: true,
          fixedOverflowWidgets: true,
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Monaco, "Courier New", monospace',
          suggestOnTriggerCharacters: true,
          tabCompletion: 'on',
        }),
      }),
    );
  });

  it('mostra compare view lado a lado quando o arquivo tem alteracoes', () => {
    render(
      <EditorPane
        tab={{
          path: 'README.md',
          name: 'README.md',
          content: '# docs atualizado',
          originalContent: '# docs',
          encoding: 'utf-8',
          mimeType: 'text/markdown',
          dirty: true,
        }}
        compareMode
        onChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Alterado')).toBeInTheDocument();
    expect(screen.getAllByTestId('monaco-editor')).toHaveLength(2);
    expect(editorSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: 'file:///README.md.original',
        options: expect.objectContaining({
          readOnly: true,
        }),
      }),
    );
    expect(editorSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: 'file:///README.md',
        options: expect.objectContaining({
          readOnly: false,
        }),
      }),
    );
  });

  it('mostra o nome do arquivo enquanto prepara o editor', () => {
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

    expect(screen.getByText('Preparando editor')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
  });

  it('mostra dica de atalho quando nenhum arquivo está selecionado', () => {
    render(<EditorPane tab={null} onChange={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText('Selecione um arquivo na árvore')).toBeInTheDocument();
    expect(screen.getByText('Dica: Ctrl+P abre a busca rápida de arquivos.')).toBeInTheDocument();
  });

  it('mantem o tema base ate o Monaco carregar o tema customizado', () => {
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
        theme: 'vs-dark',
      }),
    );
  });

  it('define e ativa o tema customizado quando o Monaco esta pronto', () => {
    monacoMock = {
      editor: {
        defineTheme: defineThemeSpy,
      },
    };

    useAppearanceStore.setState({
      installedThemes: [
        {
          id: 'github.github-vscode-theme-dark',
          extensionId: 'GitHub.github-vscode-theme',
          label: 'GitHub Dark',
          uiTheme: 'vs-dark',
          colors: { 'editor.selectionBackground': '#264f78' },
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

    expect(defineThemeSpy).toHaveBeenCalledWith(
      'ext-github-github-vscode-theme-dark',
      expect.objectContaining({ base: 'vs-dark' }),
    );
    expect(editorSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: 'ext-github-github-vscode-theme-dark',
      }),
    );

    monacoMock = null;
    defineThemeSpy.mockReset();
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
      installSupport: {
        supported: true,
        kinds: ['theme'],
        reason: null,
      },
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

  it('mostra motivo quando a extensao nao e suportada para instalacao', () => {
    const extensionDetail: ExtensionDetail = {
      extension: {
        id: 'miguelsolorio.fluent-icons',
        name: 'fluent-icons',
        namespace: 'miguelsolorio',
        displayName: 'Fluent Icons',
        description: 'Fluent product icons for Visual Studio Code',
        version: '0.0.19',
        iconUrl: 'https://example.com/fluent.png',
        downloadCount: 80020,
        averageRating: 3,
        verified: true,
      },
      readme: '# Fluent Icons',
      resources: [{ label: 'Repository', url: 'https://github.com/misolori/vscode-fluent-icons' }],
      categories: ['Themes'],
      publishedAt: '2024-10-28T03:44:36.861379Z',
      updatedAt: '2024-10-28T03:44:36.861379Z',
      installSupport: {
        supported: false,
        kinds: [],
        reason: 'Esta extensão só fornece product icons, que ainda não são suportados.',
      },
    };

    render(
      <EditorPane
        tab={{
          path: 'Extensions/Fluent Icons',
          name: 'Extension: Fluent Icons',
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

    expect(screen.getByRole('button', { name: 'Extensão não suportada' })).toBeDisabled();
    expect(screen.getByText('Esta extensão só fornece product icons, que ainda não são suportados.')).toBeInTheDocument();
  });
});
