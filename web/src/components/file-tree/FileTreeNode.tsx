import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TreeNode } from '@/types';
import { cn } from '@/lib/utils';
import { resolveMaterialFileIcon, resolveMaterialFolderIcon } from '@/lib/fileTreeIcons';

type InlineActionState =
  | { mode: 'create-file'; parentPath: string; value: string }
  | { mode: 'create-folder'; parentPath: string; value: string }
  | { mode: 'rename'; node: TreeNode; value: string };

type Props = {
  node: TreeNode | null;
  level: number;
  activePath?: string | null;
  onOpenFile: (path: string) => void;
  onOpenContextMenu: (node: TreeNode, event: MouseEvent<HTMLElement>) => void;
  inlineAction: InlineActionState | null;
  onInlineValueChange: (value: string) => void;
  onInlineSubmit: () => void;
  onInlineCancel: () => void;
};

type InlineInputProps = {
  icon: string;
  level: number;
  value: string;
  folder?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

function handleInlineKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  onSubmit: () => void,
  onCancel: () => void,
) {
  if (event.key === 'Enter') {
    event.preventDefault();
    onSubmit();
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    onCancel();
  }
}

function InlineTreeInput({ icon, level, value, folder, onChange, onSubmit, onCancel }: InlineInputProps) {
  return (
    <div
      className="flex items-center gap-1 rounded px-1 py-0.5"
      style={{ paddingLeft: 4 + level * 12 + (folder ? 0 : 14) }}
    >
      {folder ? <ChevronRight className="h-3.5 w-3.5 opacity-0" /> : null}
      <img src={icon} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />
      <Input
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value)}
        onBlur={onSubmit}
        onKeyDown={(event) => handleInlineKeyDown(event, onSubmit, onCancel)}
        className="h-7 border-border/70 bg-background px-2 text-sm"
        aria-label="Nome do arquivo"
      />
    </div>
  );
}

export function FileTreeNode({
  node,
  level,
  activePath,
  onOpenFile,
  onOpenContextMenu,
  inlineAction,
  onInlineValueChange,
  onInlineSubmit,
  onInlineCancel,
}: Props) {
  const [open, setOpen] = useState(level === 0);

  if (!node) {
    if (!inlineAction || inlineAction.mode === 'rename') return null;

    const icon =
      inlineAction.mode === 'create-folder'
        ? resolveMaterialFolderIcon('', { expanded: false })
        : resolveMaterialFileIcon(inlineAction.value || 'untitled');

    return (
      <li>
        <InlineTreeInput
          icon={icon}
          level={level}
          value={inlineAction.value}
          folder={inlineAction.mode === 'create-folder'}
          onChange={onInlineValueChange}
          onSubmit={onInlineSubmit}
          onCancel={onInlineCancel}
        />
      </li>
    );
  }

  const isActive = activePath === node.path;
  const isRenamingHere = inlineAction?.mode === 'rename' && inlineAction.node.path === node.path;
  const isCreatingHere =
    inlineAction &&
    inlineAction.mode !== 'rename' &&
    inlineAction.parentPath === node.path &&
    node.type === 'directory';

  if (node.type === 'directory') {
    const folderIcon = resolveMaterialFolderIcon(node.path, { expanded: open || Boolean(isCreatingHere) });

    return (
      <li>
        {isRenamingHere ? (
          <InlineTreeInput
            icon={folderIcon}
            level={level}
            value={inlineAction.value}
            folder
            onChange={onInlineValueChange}
            onSubmit={onInlineSubmit}
            onCancel={onInlineCancel}
          />
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onContextMenu={(event) => onOpenContextMenu(node, event)}
            className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm hover:bg-accent"
            style={{ paddingLeft: 4 + level * 12 }}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', (open || isCreatingHere) && 'rotate-90')} />
            <img src={folderIcon} alt="" aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
        )}
        {(open || isCreatingHere) && (
          <ul>
            {node.children?.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                level={level + 1}
                activePath={activePath}
                onOpenFile={onOpenFile}
                onOpenContextMenu={onOpenContextMenu}
                inlineAction={inlineAction}
                onInlineValueChange={onInlineValueChange}
                onInlineSubmit={onInlineSubmit}
                onInlineCancel={onInlineCancel}
              />
            ))}
            {isCreatingHere ? (
              <li>
                <InlineTreeInput
                  icon={
                    inlineAction.mode === 'create-folder'
                      ? resolveMaterialFolderIcon('', { expanded: false })
                      : resolveMaterialFileIcon(inlineAction.value || 'untitled')
                  }
                  level={level + 1}
                  value={inlineAction.value}
                  folder={inlineAction.mode === 'create-folder'}
                  onChange={onInlineValueChange}
                  onSubmit={onInlineSubmit}
                  onCancel={onInlineCancel}
                />
              </li>
            ) : null}
          </ul>
        )}
      </li>
    );
  }

  const fileIcon = resolveMaterialFileIcon(node.path);

  return (
    <li>
      {isRenamingHere ? (
        <InlineTreeInput
          icon={fileIcon}
          level={level}
          value={inlineAction.value}
          onChange={onInlineValueChange}
          onSubmit={onInlineSubmit}
          onCancel={onInlineCancel}
        />
      ) : (
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
      )}
    </li>
  );
}
