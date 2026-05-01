import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FilePlus2, FolderPlus, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { deleteFile, mkdir, renamePath, saveFile } from '@/api/fs';
import { useFileTree } from '@/hooks/useFileTree';
import { useEditor } from '@/hooks/useEditor';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { TreeNode } from '@/types';
import { FileTreeNode } from './FileTreeNode';

type ContextMenuState = {
  node: TreeNode;
  x: number;
  y: number;
};

type InlineActionState =
  | { mode: 'create-file'; parentPath: string; value: string }
  | { mode: 'create-folder'; parentPath: string; value: string }
  | { mode: 'rename'; node: TreeNode; value: string };

type DeleteModalState = {
  node: TreeNode;
};

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}

function getParentPath(nodePath: string): string {
  const parts = nodePath.split('/');
  parts.pop();
  return parts.join('/');
}

export function FileTree({ workspace }: { workspace: string }) {
  const { tree, loading, refresh } = useFileTree(workspace);
  const { openFile, activePath } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineAction, setInlineAction] = useState<InlineActionState | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const readOnly = permission !== 'write';

  useEffect(() => {
    if (!contextMenu) return;

    function handleClose() {
      setContextMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setContextMenu(null);
    }

    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const menuItems = useMemo(() => {
    if (!contextMenu) return [];
    const node = contextMenu.node;
    const items: Array<{
      label: string;
      icon?: ReactNode;
      disabled?: boolean;
      onSelect: () => void | Promise<void>;
    }> = [];

    if (node.type === 'file') {
      items.push({
        label: 'Abrir arquivo',
        onSelect: () => void openFile(node.path),
      });
    }

    if (node.type === 'directory') {
      items.push({
        label: 'Novo arquivo',
        icon: <FilePlus2 className="h-3.5 w-3.5" />,
        disabled: readOnly,
        onSelect: () => openInlineAction({ mode: 'create-file', parentPath: node.path, value: '' }),
      });
      items.push({
        label: 'Nova pasta',
        icon: <FolderPlus className="h-3.5 w-3.5" />,
        disabled: readOnly,
        onSelect: () => openInlineAction({ mode: 'create-folder', parentPath: node.path, value: '' }),
      });
    }

    items.push({
      label: 'Renomear',
      icon: <Pencil className="h-3.5 w-3.5" />,
      disabled: readOnly,
      onSelect: () => openInlineAction({ mode: 'rename', node, value: node.name }),
    });
    items.push({
      label: node.type === 'directory' ? 'Excluir pasta' : 'Excluir arquivo',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      disabled: readOnly,
      onSelect: () => openDeleteModal(node),
    });

    return items;
  }, [contextMenu, readOnly, openFile]);

  function openInlineAction(nextState: InlineActionState) {
    setContextMenu(null);
    setDeleteModal(null);
    setInlineAction(nextState);
  }

  function openDeleteModal(node: TreeNode) {
    setContextMenu(null);
    setInlineAction(null);
    setDeleteModal({ node });
  }

  function handleInlineValueChange(value: string) {
    setInlineAction((current) => (current ? { ...current, value } : current));
  }

  function handleInlineCancel() {
    setInlineAction(null);
  }

  async function handleInlineSubmit() {
    if (!inlineAction) return;
    const nextValue = inlineAction.value.trim();
    if (!nextValue) {
      setInlineAction(null);
      return;
    }

    try {
      if (inlineAction.mode === 'create-file') {
        const nextPath = joinPath(inlineAction.parentPath, nextValue);
        await saveFile(workspace, nextPath, '', 'utf-8');
        await refresh();
        await openFile(nextPath);
      } else if (inlineAction.mode === 'create-folder') {
        await mkdir(workspace, joinPath(inlineAction.parentPath, nextValue));
        await refresh();
      } else {
        if (nextValue === inlineAction.node.name) {
          setInlineAction(null);
          return;
        }
        await renamePath(
          workspace,
          inlineAction.node.path,
          joinPath(getParentPath(inlineAction.node.path), nextValue),
        );
        await refresh();
      }
    } catch {
      if (inlineAction.mode === 'create-file') toast.error('Falha ao criar arquivo');
      else if (inlineAction.mode === 'create-folder') toast.error('Falha ao criar pasta');
      else toast.error('Falha ao renomear');
    } finally {
      setInlineAction(null);
    }
  }

  async function handleDelete(node: TreeNode) {
    try {
      await deleteFile(workspace, node.path);
      await refresh();
    } catch {
      toast.error('Falha ao excluir');
    } finally {
      setDeleteModal(null);
    }
  }

  const showRootInlineInput =
    inlineAction && inlineAction.mode !== 'rename' && inlineAction.parentPath === '';

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {workspace}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openInlineAction({ mode: 'create-file', parentPath: '', value: '' })}
            title={readOnly ? 'Novo arquivo indisponível em modo somente leitura' : 'Novo arquivo'}
            disabled={readOnly}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openInlineAction({ mode: 'create-folder', parentPath: '', value: '' })}
            title={readOnly ? 'Nova pasta indisponível em modo somente leitura' : 'Nova pasta'}
            disabled={readOnly}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refresh()} title="Recarregar">
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">Carregando...</p>
        ) : tree.length === 0 && !showRootInlineInput ? (
          <p className="p-3 text-xs text-muted-foreground">Workspace vazio</p>
        ) : (
          <ul className="py-1">
            {showRootInlineInput && inlineAction ? (
              <FileTreeNode
                key={`inline-root-${inlineAction.mode}`}
                node={null}
                level={0}
                activePath={activePath}
                onOpenFile={(p) => void openFile(p)}
                onOpenContextMenu={(node, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ node, x: event.clientX, y: event.clientY });
                }}
                inlineAction={inlineAction}
                onInlineValueChange={handleInlineValueChange}
                onInlineSubmit={() => void handleInlineSubmit()}
                onInlineCancel={handleInlineCancel}
              />
            ) : null}
            {tree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                level={0}
                activePath={activePath}
                onOpenFile={(p) => void openFile(p)}
                onOpenContextMenu={(node, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ node, x: event.clientX, y: event.clientY });
                }}
                inlineAction={inlineAction}
                onInlineValueChange={handleInlineValueChange}
                onInlineSubmit={() => void handleInlineSubmit()}
                onInlineCancel={handleInlineCancel}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
      {contextMenu && (
        <div
          className="fixed z-50 min-w-44 rounded-md border bg-background p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void item.onSelect()}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {deleteModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md">
              <CardHeader className="pb-4">
                <CardTitle>
                  {deleteModal.node.type === 'directory' ? 'Excluir pasta' : 'Excluir arquivo'}
                </CardTitle>
                <CardDescription>
                  {`Essa ação remove ${deleteModal.node.type === 'directory' ? 'a pasta e todo o conteúdo' : 'o arquivo'} "${deleteModal.node.name}".`}
                </CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter className="justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteModal(null)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => void handleDelete(deleteModal.node)}>
                  Excluir
                </Button>
              </CardFooter>
            </Card>
          </div>,
          document.body,
        )}
    </div>
  );
}
