import { useState } from 'react';
import { GitBranch, TerminalSquare } from 'lucide-react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { FileTree } from '@/components/file-tree/FileTree';
import { EditorTabs } from '@/components/editor/EditorTabs';
import { EditorPane } from '@/components/editor/EditorPane';
import { GitPanel } from '@/components/git/GitPanel';
import { TerminalPane } from '@/components/terminal/TerminalPane';
import { StatusBar } from './StatusBar';
import { useEditor } from '@/hooks/useEditor';
import { cn } from '@/lib/utils';

type SidePanel = 'files' | 'git';

export function AppShell({ workspace }: { workspace: string }) {
  const { tabs, activePath, setActive, closeTab, updateContent, save } = useEditor();
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const [side, setSide] = useState<SidePanel>('files');
  const [showTerminal, setShowTerminal] = useState(true);

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
            className={cn('h-8 w-8', side === 'git' && 'bg-accent')}
            onClick={() => setSide('git')}
            title="Git"
          >
            <GitBranch className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8', showTerminal && 'bg-accent')}
            onClick={() => setShowTerminal((v) => !v)}
            title="Terminal"
          >
            <TerminalSquare className="h-4 w-4" />
          </Button>
        </div>

        <ResizablePanel defaultSize={22} minSize={14} maxSize={45} className="border-r">
          {side === 'files' ? <FileTree workspace={workspace} /> : <GitPanel workspace={workspace} />}
        </ResizablePanel>
        <ResizableHandle />

        <ResizablePanel defaultSize={78}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={showTerminal ? 65 : 100}>
              <div className="flex h-full flex-col">
                <EditorTabs tabs={tabs} activePath={activePath} onSelect={setActive} onClose={closeTab} />
                <div className="flex-1 overflow-hidden">
                  <EditorPane tab={activeTab} onChange={updateContent} onSave={save} />
                </div>
              </div>
            </ResizablePanel>
            {showTerminal && (
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
