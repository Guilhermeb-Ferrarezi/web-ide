import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editorStore';

describe('editorStore', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it('mantem a aba dirty quando um save antigo termina depois de nova digitacao', () => {
    useEditorStore.getState().openTab({
      path: 'README.md',
      name: 'README.md',
      content: 'linha 1',
      originalContent: 'linha 1',
      encoding: 'utf-8',
      mimeType: 'text/markdown',
      dirty: false,
      kind: 'file',
    });

    useEditorStore.getState().updateContent('README.md', 'linha 1\nlinha 2');
    useEditorStore.getState().updateContent('README.md', 'linha 1\nlinha 2\nlinha 3');
    useEditorStore.getState().markSaved('README.md', 'linha 1\nlinha 2');

    expect(useEditorStore.getState().tabs).toEqual([
      expect.objectContaining({
        path: 'README.md',
        content: 'linha 1\nlinha 2\nlinha 3',
        originalContent: 'linha 1\nlinha 2',
        dirty: true,
      }),
    ]);
  });

  it('marca a aba como salva quando o disco recebeu o conteudo atual', () => {
    useEditorStore.getState().openTab({
      path: 'README.md',
      name: 'README.md',
      content: 'linha 1',
      originalContent: 'linha 1',
      encoding: 'utf-8',
      mimeType: 'text/markdown',
      dirty: false,
      kind: 'file',
    });

    useEditorStore.getState().updateContent('README.md', 'linha 1\nlinha 2');
    useEditorStore.getState().markSaved('README.md', 'linha 1\nlinha 2');

    expect(useEditorStore.getState().tabs).toEqual([
      expect.objectContaining({
        path: 'README.md',
        content: 'linha 1\nlinha 2',
        originalContent: 'linha 1\nlinha 2',
        dirty: false,
      }),
    ]);
  });
});
