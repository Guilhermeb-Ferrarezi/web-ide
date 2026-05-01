import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditorPane } from './EditorPane';

const editorSpy = vi.fn();

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    editorSpy(props);
    return <div data-testid="monaco-editor" />;
  },
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
        options: expect.objectContaining({ readOnly: true }),
      }),
    );
  });
});
