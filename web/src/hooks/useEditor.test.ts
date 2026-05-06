import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useEditor } from './useEditor';
import * as fsApi from '@/api/fs';
import { useEditorStore } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

vi.mock('@/api/fs', () => ({
  fetchFile: vi.fn(),
  saveFile: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('useEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'read' });
  });

  it('nao salva alteracoes quando a permissao da workspace eh read', async () => {
    useEditorStore.getState().openTab({
      path: 'README.md',
      name: 'README.md',
      content: 'draft',
      originalContent: 'draft',
      encoding: 'utf-8',
      mimeType: 'text/markdown',
      dirty: false,
    });

    const { result } = renderHook(() => useEditor());

    await act(async () => {
      await result.current.save('README.md');
    });

    expect(fsApi.saveFile).not.toHaveBeenCalled();
  });

  it('mantem dirty quando o usuario digita enquanto um save anterior ainda esta em voo', async () => {
    useWorkspaceStore.setState({ workspace: 'repo', permission: 'write' });
    let resolveSave: (() => void) | null = null;
    vi.mocked(fsApi.saveFile).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

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

    const { result } = renderHook(() => useEditor());

    let savePromise!: Promise<void>;
    await act(async () => {
      savePromise = result.current.save('README.md');
    });

    await act(async () => {
      useEditorStore.getState().updateContent('README.md', 'linha 1\nlinha 2\nlinha 3');
    });

    await act(async () => {
      resolveSave?.();
      await savePromise;
    });

    expect(fsApi.saveFile).toHaveBeenCalledWith('repo', 'README.md', 'linha 1\nlinha 2', 'utf-8');
    expect(useEditorStore.getState().tabs).toEqual([
      expect.objectContaining({
        path: 'README.md',
        content: 'linha 1\nlinha 2\nlinha 3',
        originalContent: 'linha 1\nlinha 2',
        dirty: true,
      }),
    ]);
  });
});
