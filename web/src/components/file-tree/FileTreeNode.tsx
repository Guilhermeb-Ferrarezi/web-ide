import { useState, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { TreeNode } from '@/types';
import { cn } from '@/lib/utils';
import { resolveDefaultFileIcon, resolveDefaultFolderIcon, resolveFileIcon, resolveFolderIcon } from '@/lib/fileTreeIcons';
import { IconWithFallback } from '@/components/shared/IconWithFallback';

type InlineActionState =
  | { mode: 'create-file'; parentPath: string; value: string }
  | { mode: 'create-folder'; parentPath: string; value: string }
  | { mode: 'rename'; node: TreeNode; value: string };

type Props = {
  node: TreeNode | null;
  level: number;
  activePath?: string | null;
  selectedPath?: string | null;
  onOpenFile: (path: string) => void;
  onOpenContextMenu: (node: TreeNode, event: MouseEvent<HTMLElement>) => void;
  onSelectNode: (node: TreeNode) => void;
  onDragStart: (node: TreeNode) => void;
  onDragEnd: () => void;
  onDragOverDirectory: (targetPath: string, event: DragEvent<HTMLElement>) => void;
  onDropIntoDirectory: (targetPath: string, event: DragEvent<HTMLElement>) => void;
  dropTargetPath?: string | null;
  inlineAction: InlineActionState | null;
  onInlineValueChange: (value: string) => void;
  onInlineSubmit: () => void;
  onInlineCancel: () => void;
};

type InlineInputProps = {
  icon: string;
  fallbackIcon: string;
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

function InlineTreeInput({ icon, fallbackIcon, level, value, folder, onChange, onSubmit, onCancel }: InlineInputProps) {
  return (
    <div
      className="flex items-center gap-1 rounded px-1 py-0.5"
      style={{ paddingLeft: 4 + level * 12 + (folder ? 0 : 14) }}
    >
      {folder ? <ChevronRight className="h-3.5 w-3.5 opacity-0" /> : null}
      <IconWithFallback src={icon} fallbackSrc={fallbackIcon} alt="" ariaHidden className="h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Input
          value={value}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          onBlur={onSubmit}
          onKeyDown={(event) => handleInlineKeyDown(event, onSubmit, onCancel)}
          className="h-7 border-border/70 bg-background px-2 text-sm"
          aria-label="Nome do arquivo"
        />
        <span className="text-[10px] text-muted-foreground">Enter para confirmar • Esc para cancelar</span>
      </div>
    </div>
  );
}

export function FileTreeNode({
  node,
  level,
  activePath,
  selectedPath,
  onOpenFile,
  onOpenContextMenu,
  onSelectNode,
  onDragStart,
  onDragEnd,
  onDragOverDirectory,
  onDropIntoDirectory,
  dropTargetPath,
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
        ? resolveFolderIcon('', { expanded: false })
        : resolveFileIcon(inlineAction.value || 'untitled');
    const fallbackIcon =
      inlineAction.mode === 'create-folder'
        ? resolveDefaultFolderIcon('', { expanded: false })
        : resolveDefaultFileIcon(inlineAction.value || 'untitled');

    return (
      <li>
        <InlineTreeInput
          icon={icon}
          fallbackIcon={fallbackIcon}
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
  const isSelected = selectedPath === node.path;
  const isRenamingHere = inlineAction?.mode === 'rename' && inlineAction.node.path === node.path;
  const isCreatingHere =
    inlineAction &&
    inlineAction.mode !== 'rename' &&
    inlineAction.parentPath === node.path &&
    node.type === 'directory';

  if (node.type === 'directory') {
    const folderIcon = resolveFolderIcon(node.path, { expanded: open || Boolean(isCreatingHere) });
    const fallbackFolderIcon = resolveDefaultFolderIcon(node.path, { expanded: open || Boolean(isCreatingHere) });
    const isDropTarget = dropTargetPath === node.path;

    return (
      <li>
        {isRenamingHere ? (
          <InlineTreeInput
            icon={folderIcon}
            fallbackIcon={fallbackFolderIcon}
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
            draggable
            onClick={() => {
              onSelectNode(node);
              setOpen((v) => !v);
            }}
            onContextMenu={(event) => onOpenContextMenu(node, event)}
            onDragStart={(event) => {
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
              onDragStart(node);
            }}
            onDragEnd={onDragEnd}
            onDragEnter={(event) => {
              onDragOverDirectory(node.path, event);
              if (!open) setOpen(true);
            }}
            onDragOver={(event) => onDragOverDirectory(node.path, event)}
            onDrop={(event) => onDropIntoDirectory(node.path, event)}
            className={cn(
              'flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm transition-all hover:bg-accent',
              (isSelected || isActive) && 'bg-accent',
              isDropTarget && 'ring-2 ring-primary/40 bg-accent/70 shadow-sm',
            )}
            data-drop-target={isDropTarget ? 'true' : 'false'}
            style={{ paddingLeft: 4 + level * 12 }}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', (open || isCreatingHere) && 'rotate-90')} />
            <IconWithFallback src={folderIcon} fallbackSrc={fallbackFolderIcon} alt="" ariaHidden className="h-4 w-4 shrink-0" />
            <span className={cn('truncate', isDropTarget && 'font-medium text-foreground')}>{node.name}</span>
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
                selectedPath={selectedPath}
                onOpenFile={onOpenFile}
                onOpenContextMenu={onOpenContextMenu}
                onSelectNode={onSelectNode}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onDragOverDirectory={onDragOverDirectory}
                onDropIntoDirectory={onDropIntoDirectory}
                dropTargetPath={dropTargetPath}
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
                      ? resolveFolderIcon('', { expanded: false })
                      : resolveFileIcon(inlineAction.value || 'untitled')
                  }
                  fallbackIcon={
                    inlineAction.mode === 'create-folder'
                      ? resolveDefaultFolderIcon('', { expanded: false })
                      : resolveDefaultFileIcon(inlineAction.value || 'untitled')
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

  const fileIcon = resolveFileIcon(node.path);
  const fallbackFileIcon = resolveDefaultFileIcon(node.path);

  return (
    <li>
      {isRenamingHere ? (
        <InlineTreeInput
          icon={fileIcon}
          fallbackIcon={fallbackFileIcon}
          level={level}
          value={inlineAction.value}
          onChange={onInlineValueChange}
          onSubmit={onInlineSubmit}
          onCancel={onInlineCancel}
        />
      ) : (
        <button
          type="button"
          draggable
          onClick={() => {
            onSelectNode(node);
            onOpenFile(node.path);
          }}
          onContextMenu={(event) => onOpenContextMenu(node, event)}
          onDragStart={(event) => {
            if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
            onDragStart(node);
          }}
          onDragEnd={onDragEnd}
          className={cn(
            'flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm transition-all hover:bg-accent',
            (isActive || isSelected) && 'bg-accent',
          )}
          style={{ paddingLeft: 4 + level * 12 + 14 }}
        >
          <IconWithFallback src={fileIcon} fallbackSrc={fallbackFileIcon} alt="" ariaHidden className="h-4 w-4 shrink-0" />
          <span className="truncate">{node.name}</span>
        </button>
      )}
    </li>
  );
}
