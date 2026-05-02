import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { AppShell } from '@/components/layout/AppShell';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useEditorStore } from '@/stores/editorStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import { useWatcher } from '@/hooks/useWatcher';
import { watcherBus } from '@/lib/watcherBus';
import { fetchFile } from '@/api/fs';
import { listLocalRepos } from '@/api/repos';
import { getInstalledExtensions } from '@/api/extensions';

export default function IDEPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const navigate = useNavigate();
  const setPermission = useWorkspaceStore((s) => s.setPermission);
  const permission = useWorkspaceStore((s) => s.permission);
  const replaceInstalled = useAppearanceStore((s) => s.replaceInstalled);
  const resetInstalled = useAppearanceStore((s) => s.resetInstalled);
  const [loadingPermission, setLoadingPermission] = useState(true);
  const [loadingExtensions, setLoadingExtensions] = useState(true);

  useEffect(() => {
    const workspaceStore = useWorkspaceStore.getState();
    const editorStore = useEditorStore.getState();
    const appearanceStore = useAppearanceStore.getState();

    workspaceStore.setWorkspace(workspace ?? null);
    workspaceStore.setPermission(null);
    editorStore.reset();
    appearanceStore.resetInstalled();
    setLoadingPermission(true);
    setLoadingExtensions(true);
    return () => {
      workspaceStore.setWorkspace(null);
      workspaceStore.setPermission(null);
      editorStore.reset();
      appearanceStore.resetInstalled();
    };
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      setLoadingPermission(true);
      try {
        const repos = await listLocalRepos();
        const repo = repos.find((entry) => entry.slug === workspace);
        if (!cancelled) setPermission(repo?.permission ?? null);
      } catch {
        if (!cancelled) setPermission(null);
      } finally {
        if (!cancelled) setLoadingPermission(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, setPermission]);

  useWatcher(workspace ?? null, (e) => watcherBus.emit(e));

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    void (async () => {
      setLoadingExtensions(true);
      try {
        const installed = await getInstalledExtensions();
        if (!cancelled) replaceInstalled(installed, workspace);
      } catch {
        if (!cancelled) resetInstalled();
      } finally {
        if (!cancelled) setLoadingExtensions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, replaceInstalled, resetInstalled]);

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

  const booting = loadingPermission || loadingExtensions;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/repos')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Repositórios
        </Button>
        <span className="text-sm font-medium">{workspace}</span>
        {permission && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${permission === 'write' ? 'bg-green-500' : 'bg-yellow-500'}`}
                />
              </TooltipTrigger>
              <TooltipContent className="flex flex-col gap-1.5 p-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  <span>Pode alterar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span>Somente leitura</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </header>
      <div className="flex-1 overflow-hidden">
        {booting ? (
          <div className="flex h-full flex-col bg-background">
            <div className="grid h-full grid-cols-[40px_280px_minmax(0,1fr)]">
              <div className="border-r bg-muted/20 p-2">
                <div className="flex h-full flex-col items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
              <div className="border-r p-3">
                <Skeleton className="mb-3 h-4 w-32" />
                <Skeleton className="mb-2 h-8 w-full" />
                <Skeleton className="mb-2 h-8 w-11/12" />
                <Skeleton className="mb-2 h-8 w-10/12" />
              </div>
              <div className="flex flex-col p-3">
                <div className="mb-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">Preparando permissões, extensões e editor...</p>
                  <p className="text-xs text-muted-foreground">Aguarde enquanto o workspace {workspace} é carregado.</p>
                </div>
                <Skeleton className="mb-2 h-9 w-full" />
                <Skeleton className="mb-2 h-8 w-56" />
                <div className="flex-1 rounded-xl border bg-card/50 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <Skeleton className="mb-2 h-4 w-72" />
                  <Skeleton className="mb-2 h-4 w-64" />
                  <Skeleton className="mb-2 h-4 w-80" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AppShell workspace={workspace} />
        )}
      </div>
    </div>
  );
}
