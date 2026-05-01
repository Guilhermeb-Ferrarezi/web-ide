import { useEffect, useState } from 'react';
import { GitBranch, TerminalSquare } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileTree } from '@/components/file-tree/FileTree';
import { EditorBreadcrumbs } from '@/components/editor/EditorBreadcrumbs';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { EditorPane } from '@/components/editor/EditorPane';
import { GitPanel } from '@/components/git/GitPanel';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { StatusBar } from './StatusBar';
import { useEditor } from '@/hooks/useEditor';
import { useGitStatus } from '@/hooks/useGitStatus';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type SidePanel = 'files' | 'git';

export function AppShell({ workspace }: { workspace: string }) {
  const { tabs, activePath, setActive, closeTab, updateContent, save } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const { status: gitStatus } = useGitStatus(workspace);
  const [side, setSide] = useState<SidePanel>('files');
  const [showTerminal, setShowTerminal] = useState(true);
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

  return (
    <div className="flex h-full flex-col">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <div className="flex h-full w-10 shrink-0 flex-col items-center gap-1 border-r bg-muted/30 py-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', side === 'files' && 'bg-accent')}
            onClick={() => setSide('files')}
            title="Arquivos"
          >
            <span className="text-base">📁</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('relative h-8 w-8', side === 'git' && 'bg-accent')}
            onClick={() => setSide('git')}
            title="Git"
          >
            <GitBranch className="h-4 w-4" />
            {gitChangedCount > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-emerald-500 px-1 text-[10px] font-semibold leading-4 text-emerald-950">
                {gitChangedCount}
              </span>
            )}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', showTerminal && 'bg-accent')}
            onClick={() => setShowTerminal((v) => !v)}
            title={permission === 'write' ? 'Terminal' : 'Terminal indisponível em modo somente leitura'}
            disabled={permission !== 'write'}
          >
            <TerminalSquare className="h-4 w-4" />
          </Button>
        </div>

        <ResizablePanel defaultSize={22} minSize={14} maxSize={45} className="border-r">
          {side === 'files' ? <FileTree workspace={workspace} /> : <GitPanel workspace={workspace} readOnly={permission !== 'write'} />}
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
