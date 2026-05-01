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
});
