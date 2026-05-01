import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AppShell } from '@/components/layout/AppShell';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';
import { useWatcher } from '@/hooks/useWatcher';
import { watcherBus } from '@/lib/watcherBus';
import { fetchFile } from '@/api/fs';
import { listLocalRepos } from '@/api/repos';

export default function IDEPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const navigate = useNavigate();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const setPermission = useWorkspaceStore((s) => s.setPermission);
  const permission = useWorkspaceStore((s) => s.permission);
  const resetEditor = useEditorStore((s) => s.reset);

  useEffect(() => {
    setWorkspace(workspace ?? null);
    setPermission(null);
    resetEditor();
    return () => {
      setWorkspace(null);
      setPermission(null);
      resetEditor();
    };
  }, [workspace, setWorkspace, setPermission, resetEditor]);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      try {
        const repos = await listLocalRepos();
        const repo = repos.find((entry) => entry.slug === workspace);
        if (!cancelled) setPermission(repo?.permission ?? null);
      } catch {
        if (!cancelled) setPermission(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, setPermission]);

  useWatcher(workspace ?? null, (e) => watcherBus.emit(e));

  useEffect(() => {
    if (!workspace) return;
    return watcherBus.subscribe(async (e) => {
      if (e.kind !== 'fs') return;
      const { tabs } = useEditorStore.getState();
      const tab = tabs.find((t) => t.path === e.path);
      if (!tab || tab.dirty) return;
      if (e.event === 'unlink') {
        useEditorStore.getState().closeTab(e.path);
        return;
      }
      if (e.event === 'change' || e.event === 'add') {
        try {
          const file = await fetchFile(workspace, e.path);
          useEditorStore.setState((s) => ({
            tabs: s.tabs.map((t) =>
              t.path === e.path
                ? { ...t, content: file.content, originalContent: file.content, dirty: false, encoding: file.encoding, mimeType: file.mimeType }
                : t,
            ),
          }));
        } catch {
          // ignore
        }
      }
    });
  }, [workspace]);

  if (!workspace) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repos')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Repositórios
        </Button>
        <span className="text-sm font-medium">{workspace}</span>
        {permission && (
          <Badge variant={permission === 'write' ? 'default' : 'secondary'}>
            {permission === 'write' ? 'Pode editar' : 'Somente leitura'}
          </Badge>
        )}
      </header>
      <div className="flex-1 overflow-hidden">
        <AppShell workspace={workspace} />
      </div>
    </div>
  );
}
