import { useCallback } from 'react';
import { toast } from 'sonner';
import { fetchFile, saveFile } from '@/api/fs';
import { useEditorStore, type EditorJump } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useEditor() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const permission = useWorkspaceStore((s) => s.permission);
  const { tabs, activePath, openTab, closeTab, setActive, updateContent, markSaved, setPendingJump } = useEditorStore();

  const openFile = useCallback(
    async (filePath: string, jump?: EditorJump) => {
      if (!workspace) return;
      if (jump) setPendingJump(jump);
      const alreadyOpen = useEditorStore.getState().tabs.find((t) => t.path === filePath);
      if (alreadyOpen) {
        setActive(filePath);
        return;
      }
      try {
        const file = await fetchFile(workspace, filePath);
        const name = filePath.split('/').pop() ?? filePath;
        openTab({
          path: filePath,
          name,
          content: file.content,
          originalContent: file.content,
          encoding: file.encoding,
          mimeType: file.mimeType,
          dirty: false,
        });
      } catch {
        toast.error('Falha ao abrir arquivo');
      }
    },
    [workspace, openTab, setActive, setPendingJump],
  );

  const save = useCallback(
    async (filePath: string) => {
      const tab = useEditorStore.getState().tabs.find((t) => t.path === filePath);
      if (!workspace || !tab || permission !== 'write') return;
      try {
        await saveFile(workspace, tab.path, tab.content, tab.encoding);
        markSaved(filePath);
      } catch {
        toast.error('Falha ao salvar');
      }
    },
    [workspace, permission, markSaved],
  );

  const updateContentIfWritable = useCallback(
    (path: string, content: string) => {
      if (permission !== 'write') return;
      updateContent(path, content);
    },
    [permission, updateContent],
  );

  return { tabs, activePath, openFile, closeTab, setActive, updateContent: updateContentIfWritable, save };
}
