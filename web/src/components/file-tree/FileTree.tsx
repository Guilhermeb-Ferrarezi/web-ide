import { RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFileTree } from '@/hooks/useFileTree';
import { useEditor } from '@/hooks/useEditor';
import { FileTreeNode } from './FileTreeNode';

export function FileTree({ workspace }: { workspace: string }) {
  const { tree, loading, refresh } = useFileTree(workspace);
  const { openFile, activePath } = useEditor();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {workspace}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refresh()} title="Recarregar">
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">Carregando...</p>
        ) : tree.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">Workspace vazio</p>
        ) : (
          <ul className="py-1">
            {tree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                level={0}
                activePath={activePath}
                onOpenFile={(p) => void openFile(p)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
