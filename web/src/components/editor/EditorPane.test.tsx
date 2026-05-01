import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';
import { useAppearanceStore } from '@/stores/appearanceStore';

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
});
