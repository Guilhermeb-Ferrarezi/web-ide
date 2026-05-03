import { useCallback } from 'react';
import { toast } from 'sonner';
import { fetchFile, saveFile } from '@/api/fs';
import { fetchDiffFile } from '@/api/git';
import { useEditorStore, type EditorJump } from '@/stores/editorStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useEditor() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const permission = useWorkspaceStore((s) => s.permission);
  const { tabs, activePath, openTab, upsertTab, closeTab, setActive, updateContent, markSaved, setPendingJump } = useEditorStore();

  const openFile = useCallback(
    async (filePath: string, jump?: EditorJump) => {
      if (!workspace) return;
      if (jump) setPendingJump(jump);
      const alreadyOpen = useEditorStore.getState().tabs.find((t) => t.path === filePath);
      if (alreadyOpen) {
        setActive(filePath);
        return;
      }
      const name = filePath.split('/').pop() ?? filePath;
      openTab({
        path: filePath,
        name,
        content: '',
        originalContent: '',
        encoding: 'utf-8',
        mimeType: 'text/plain',
        dirty: false,
        kind: 'file',
        isLoading: true,
        loadingLabel: 'Abrindo arquivo...',
      });
      try {
        const file = await fetchFile(workspace, filePath);
        upsertTab({
          path: filePath,
          name,
          content: file.content,
          originalContent: file.content,
          encoding: file.encoding,
          mimeType: file.mimeType,
          dirty: false,
          kind: 'file',
          isLoading: false,
          loadingLabel: null,
        });
      } catch {
        closeTab(filePath);
        toast.error('Falha ao abrir arquivo');
      }
    },
    [workspace, openTab, upsertTab, closeTab, setActive, setPendingJump],
  );

  const save = useCallback(
    async (filePath: string) => {
      const tab = useEditorStore.getState().tabs.find((t) => t.path === filePath);
      if (!workspace || !tab || tab.kind !== 'file' || permission !== 'write') return;
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

  const openGitDiff = useCallback(
    async (filePath: string, options?: { staged?: boolean }) => {
      if (!workspace) return;

      const staged = options?.staged ?? false;
      const diffPath = `git:${staged ? 'staged' : 'unstaged'}:${filePath}`;
      const alreadyOpen = useEditorStore.getState().tabs.find((t) => t.path === diffPath);
      if (alreadyOpen) {
        setActive(diffPath);
        return;
      }

      const name = filePath.split('/').pop() ?? filePath;
      openTab({
        path: diffPath,
        name,
        content: '',
        originalContent: '',
        encoding: 'utf-8',
        mimeType: 'text/plain',
        dirty: false,
        kind: 'git-diff',
        isLoading: true,
        loadingLabel: 'Abrindo diff...',
        gitDiff: {
          filePath,
          staged,
          originalLabel: staged ? 'HEAD' : 'Index',
          modifiedLabel: staged ? 'Stage' : 'Working Tree',
        },
      });

      try {
        const diff = await fetchDiffFile(workspace, filePath, staged);
        upsertTab({
          path: diffPath,
          name,
          content: diff.targetContent,
          originalContent: diff.baseContent,
          encoding: 'utf-8',
          mimeType: 'text/plain',
          dirty: false,
          kind: 'git-diff',
          isLoading: false,
          loadingLabel: null,
          gitDiff: {
            filePath,
            staged,
            originalLabel: staged ? 'HEAD' : 'Index',
            modifiedLabel: staged ? 'Stage' : 'Working Tree',
          },
        });
      } catch {
        closeTab(diffPath);
        toast.error('Falha ao abrir diff do Git');
      }
    },
    [workspace, openTab, upsertTab, closeTab, setActive],
  );

  return { tabs, activePath, openFile, openGitDiff, closeTab, setActive, updateContent: updateContentIfWritable, save };
}
