import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Blocks, FileSearch, GitBranch, TerminalSquare } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileTree } from '@/components/file-tree/FileTree';
import { EditorBreadcrumbs } from '@/components/editor/EditorBreadcrumbs';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { EditorPane } from '@/components/editor/EditorPane';
import { GitPanel } from '@/components/git/GitPanel';
import { ExtensionsPanel } from '@/components/extensions/ExtensionsPanel';
import { CodeSearchPanel } from '@/components/shared/CodeSearchPanel';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { StatusBar } from './StatusBar';
import { useEditor } from '@/hooks/useEditor';
import { useGitStatus } from '@/hooks/useGitStatus';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type SidePanel = 'files' | 'search' | 'git' | 'extensions';

export function AppShell({ workspace }: { workspace: string }) {
  const { tabs, activePath, setActive, closeTab: closeTabRaw, updateContent, save } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (tab?.dirty && !window.confirm(`"${tab.name}" tem alterações não salvas. Fechar mesmo assim?`)) return;
      closeTabRaw(path);
    },
    [tabs, closeTabRaw],
  );
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const { status: gitStatus } = useGitStatus(workspace);
  const [side, setSide] = useState<SidePanel>('files');
  const [showTerminal, setShowTerminal] = useState(true);
  const fileFilterRef = useRef<HTMLInputElement>(null) as RefObject<HTMLInputElement>;
  const gitChangedCount = gitStatus
    ? new Set([
        ...gitStatus.staged.map((file) => file.path),
        ...gitStatus.unstaged.map((file) => file.path),
        ...gitStatus.untracked,
      ]).size
    : 0;

  useEffect(() => {
    if (permission !== 'write') setShowTerminal(false);
  }, [permission]);

  useEffect(() => {
    const dirtyCount = tabs.filter((t) => t.dirty).length;
    const base = workspace;
    document.title = dirtyCount > 0 ? `● ${base}` : base;
    return () => { document.title = base; };
  }, [tabs, workspace]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '1') { e.preventDefault(); setSide('files'); }
      else if (e.key === '2') { e.preventDefault(); setSide('search'); }
      else if (e.key === '3') { e.preventDefault(); setSide('git'); }
      else if (e.key === '4') { e.preventDefault(); setSide('extensions'); }
      else if (e.key === 'p') {
        e.preventDefault();
        setSide('files');
        setTimeout(() => fileFilterRef.current?.focus(), 50);
      } else if (e.key === 'w') {
        e.preventDefault();
        const path = activePath;
        if (path) closeTab(path);
      } else if (e.key === '`') {
        e.preventDefault();
        if (permission === 'write') setShowTerminal((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePath, closeTab]);

  return (
    <div className="flex h-full flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <TooltipProvider delayDuration={600}>
        <div className="flex h-full w-10 shrink-0 flex-col items-center gap-1 border-r bg-muted/30 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Arquivos"
                aria-keyshortcuts="Ctrl+1"
                className={cn('h-8 w-8', side === 'files' && 'bg-accent')}
                onClick={() => setSide('files')}
              >
                <span className="text-base">📁</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Arquivos <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+1</kbd> · Filtrar <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+P</kbd></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Buscar código"
                aria-keyshortcuts="Ctrl+2"
                className={cn('h-8 w-8', side === 'search' && 'bg-accent')}
                onClick={() => setSide('search')}
              >
                <FileSearch className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Buscar código <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+2</kbd></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Git"
                aria-keyshortcuts="Ctrl+3"
                className={cn('relative h-8 w-8', side === 'git' && 'bg-accent')}
                onClick={() => setSide('git')}
              >
                <GitBranch className="h-4 w-4" />
                {gitChangedCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-emerald-500 px-1 text-[10px] font-semibold leading-4 text-emerald-950">
                    {gitChangedCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Git <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+3</kbd></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Extensões"
                aria-keyshortcuts="Ctrl+4"
                className={cn('h-8 w-8', side === 'extensions' && 'bg-accent')}
                onClick={() => setSide('extensions')}
              >
                <Blocks className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Extensões <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+4</kbd></TooltipContent>
          </Tooltip>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Terminal"
                className={cn('h-8 w-8', showTerminal && 'bg-accent')}
                onClick={() => setShowTerminal((v) => !v)}
                disabled={permission !== 'write'}
              >
                <TerminalSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {permission === 'write' ? <>Terminal <kbd className="ml-1 rounded border px-1 font-mono text-[10px]">Ctrl+`</kbd></> : 'Terminal indisponível em modo somente leitura'}
            </TooltipContent>
          </Tooltip>
        </div>
        </TooltipProvider>

        <ResizablePanel defaultSize={22} minSize={14} maxSize={45} className="border-r">
          {side === 'files' ? <FileTree workspace={workspace} filterInputRef={fileFilterRef} /> : null}
          {side === 'search' ? <CodeSearchPanel workspace={workspace} /> : null}
          {side === 'git' ? <GitPanel workspace={workspace} readOnly={permission !== 'write'} /> : null}
          {side === 'extensions' ? <ExtensionsPanel /> : null}
        </ResizablePanel>
        <ResizableHandle />

        <ResizablePanel defaultSize={78}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={showTerminal ? 65 : 100}>
              <div className="flex h-full flex-col">
                {permission !== 'write' && (
                  <div className="flex items-center justify-between gap-3 border-b bg-amber-500/10 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">Modo somente leitura</p>
                      <p className="text-xs text-muted-foreground">
                        Você pode navegar, mas não editar arquivos, usar terminal ou executar ações de Git com escrita.
                      </p>
                    </div>
                    <Badge variant="outline">read</Badge>
                  </div>
                )}
                <EditorTabs tabs={tabs} activePath={activePath} onSelect={setActive} onClose={closeTab} />
                <EditorBreadcrumbs path={activeTab?.path ?? null} dirty={activeTab?.dirty} />
                <div className="flex-1 overflow-hidden">
                  <EditorPane tab={activeTab} readOnly={permission !== 'write'} onChange={updateContent} onSave={save} />
                </div>
              </div>
            </ResizablePanel>
            {showTerminal && permission === 'write' && (
              <>
                <ResizableHandle />
                <ResizablePanel defaultSize={35} minSize={15}>
                  <TerminalPane workspace={workspace} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
      <StatusBar workspace={workspace} />
    </div>
  );
}
