import { useState, type MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import type { TreeNode } from '@/types';
import { cn } from '@/lib/utils';
import { resolveMaterialFileIcon, resolveMaterialFolderIcon } from '@/lib/fileTreeIcons';

type Props = {
  node: TreeNode;
  level: number;
  activePath?: string | null;
  onOpenFile: (path: string) => void;
  onOpenContextMenu: (node: TreeNode, event: MouseEvent<HTMLElement>) => void;
};

export function FileTreeNode({ node, level, activePath, onOpenFile, onOpenContextMenu }: Props) {
  const [open, setOpen] = useState(level === 0);
  const isActive = activePath === node.path;

  if (node.type === 'directory') {
    const folderIcon = resolveMaterialFolderIcon(node.path, { expanded: open });

    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          onContextMenu={(event) => onOpenContextMenu(node, event)}
          className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent"
          style={{ paddingLeft: 4 + level * 12 }}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          <img src={folderIcon} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />
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
                onOpenContextMenu={onOpenContextMenu}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const fileIcon = resolveMaterialFileIcon(node.path);

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(node.path)}
        onContextMenu={(event) => onOpenContextMenu(node, event)}
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent',
          isActive && 'bg-accent',
        )}
        style={{ paddingLeft: 4 + level * 12 + 14 }}
      >
        <img src={fileIcon} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
