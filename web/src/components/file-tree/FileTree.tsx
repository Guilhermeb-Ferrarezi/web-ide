import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FilePlus2, FolderPlus, Pencil, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

type ActionModalState =
  | { mode: 'create-file'; parentPath: string; value: string }
  | { mode: 'create-folder'; parentPath: string; value: string }
  | { mode: 'rename'; node: TreeNode; value: string }
  | { mode: 'delete'; node: TreeNode };

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
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null);
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
        onSelect: () => openActionModal({ mode: 'create-file', parentPath: node.path, value: '' }),
      });
      items.push({
        label: 'Nova pasta',
        icon: <FolderPlus className="h-3.5 w-3.5" />,
        disabled: readOnly,
        onSelect: () => openActionModal({ mode: 'create-folder', parentPath: node.path, value: '' }),
      });
    }

    items.push({
      label: 'Renomear',
      icon: <Pencil className="h-3.5 w-3.5" />,
      disabled: readOnly,
      onSelect: () => openActionModal({ mode: 'rename', node, value: node.name }),
    });
    items.push({
      label: node.type === 'directory' ? 'Excluir pasta' : 'Excluir arquivo',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      disabled: readOnly,
      onSelect: () => openActionModal({ mode: 'delete', node }),
    });

    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextMenu, readOnly, openFile]);

  function openActionModal(nextState: ActionModalState) {
    setContextMenu(null);
    setActionModal(nextState);
  }

  async function handleCreateFile(parentPath: string, name: string) {
    if (!name.trim()) return;
    try {
      const nextPath = joinPath(parentPath, name.trim());
      await saveFile(workspace, nextPath, '', 'utf-8');
      await refresh();
      await openFile(nextPath);
    } catch {
      toast.error('Falha ao criar arquivo');
    } finally {
      setActionModal(null);
    }
  }

  async function handleCreateFolder(parentPath: string, name: string) {
    if (!name.trim()) return;
    try {
      await mkdir(workspace, joinPath(parentPath, name.trim()));
      await refresh();
    } catch {
      toast.error('Falha ao criar pasta');
    } finally {
      setActionModal(null);
    }
  }

  async function handleRename(node: TreeNode, nextName: string) {
    if (!nextName.trim() || nextName.trim() === node.name) return setActionModal(null);
    try {
      await renamePath(workspace, node.path, joinPath(getParentPath(node.path), nextName.trim()));
      await refresh();
    } catch {
      toast.error('Falha ao renomear');
    } finally {
      setActionModal(null);
    }
  }

  async function handleDelete(node: TreeNode) {
    try {
      await deleteFile(workspace, node.path);
      await refresh();
    } catch {
      toast.error('Falha ao excluir');
    } finally {
      setActionModal(null);
    }
  }

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
            onClick={() => openActionModal({ mode: 'create-file', parentPath: '', value: '' })}
            title={readOnly ? 'Novo arquivo indisponível em modo somente leitura' : 'Novo arquivo'}
            disabled={readOnly}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openActionModal({ mode: 'create-folder', parentPath: '', value: '' })}
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
                onOpenContextMenu={(node, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({ node, x: event.clientX, y: event.clientY });
                }}
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
      {actionModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader className="pb-4">
              <CardTitle>
                {actionModal.mode === 'create-file' && 'Criar novo arquivo'}
                {actionModal.mode === 'create-folder' && 'Criar nova pasta'}
                {actionModal.mode === 'rename' && 'Renomear item'}
                {actionModal.mode === 'delete' &&
                  (actionModal.node.type === 'directory' ? 'Excluir pasta' : 'Excluir arquivo')}
              </CardTitle>
              <CardDescription>
                {actionModal.mode === 'create-file' && 'Defina o nome do arquivo a ser criado.'}
                {actionModal.mode === 'create-folder' && 'Defina o nome da pasta a ser criada.'}
                {actionModal.mode === 'rename' && 'Escolha o novo nome do item selecionado.'}
                {actionModal.mode === 'delete' &&
                  `Essa ação remove ${actionModal.node.type === 'directory' ? 'a pasta e todo o conteúdo' : 'o arquivo'} "${actionModal.node.name}".`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionModal.mode !== 'delete' && (
                <div className="space-y-2">
                  <label htmlFor="file-tree-action-name" className="text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="file-tree-action-name"
                    value={actionModal.value}
                    onChange={(event) =>
                      setActionModal((current) =>
                        current && current.mode !== 'delete'
                          ? { ...current, value: event.target.value }
                          : current,
                      )
                    }
                    autoFocus
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" onClick={() => setActionModal(null)}>
                Cancelar
              </Button>
              <Button
                variant={actionModal.mode === 'delete' ? 'destructive' : 'default'}
                onClick={() => {
                  if (actionModal.mode === 'create-file') return void handleCreateFile(actionModal.parentPath, actionModal.value);
                  if (actionModal.mode === 'create-folder') return void handleCreateFolder(actionModal.parentPath, actionModal.value);
                  if (actionModal.mode === 'rename') return void handleRename(actionModal.node, actionModal.value);
                  return void handleDelete(actionModal.node);
                }}
              >
                {actionModal.mode === 'delete' ? 'Excluir' : actionModal.mode === 'rename' ? 'Salvar' : 'Criar'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
