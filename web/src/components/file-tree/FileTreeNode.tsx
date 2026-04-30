import { useState } from 'react';
import { ChevronRight, File as FileIcon, Folder, FolderOpen } from 'lucide-react';
import type { TreeNode } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
  node: TreeNode;
  level: number;
  activePath?: string | null;
  onOpenFile: (path: string) => void;
};

export function FileTreeNode({ node, level, activePath, onOpenFile }: Props) {
  const [open, setOpen] = useState(level === 0);
  const isActive = activePath === node.path;

  if (node.type === 'directory') {
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent"
          style={{ paddingLeft: 4 + level * 12 }}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && node.children.length > 0 && (
          <ul>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                activePath={activePath}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(node.path)}
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent',
          isActive && 'bg-accent',
        )}
        style={{ paddingLeft: 4 + level * 12 + 14 }}
      >
        <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
