import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Copy, FilePlus2, FolderPlus, Pencil, RefreshCcw, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { deleteFile, mkdir, renamePath, saveFile, uploadFile } from '@/api/fs';
import { fetchFile } from '@/api/fs';
import { useFileTree } from '@/hooks/useFileTree';
import { useEditor } from '@/hooks/useEditor';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { TreeNode } from '@/types';
import { cn } from '@/lib/utils';
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

type FileSnapshot =
  | {
      kind: 'file';
      node: TreeNode;
      content: string;
      encoding: 'utf-8' | 'base64';
    }
  | {
      kind: 'directory';
      node: TreeNode;
      children: FileSnapshot[];
    };

type HistoryEntry =
  | {
      kind: 'rename';
      from: string;
      to: string;
    }
  | {
      kind: 'delete';
      snapshot: FileSnapshot;
    };

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}/${child}` : child;
}

function getParentPath(nodePath: string): string {
  const parts = nodePath.split('/');
  parts.pop();
  return parts.join('/');
}

function getNodeName(nodePath: string): string {
  return nodePath.split('/').filter(Boolean).at(-1) ?? nodePath;
}

function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const match = findNodeByPath(node.children, path);
      if (match) return match;
    }
  }
  return null;
}

function resolveUploadTargetPath(tree: TreeNode[], selectedPath: string | null, fallbackPath: string): string {
  if (fallbackPath) return fallbackPath;
  if (!selectedPath) return fallbackPath;
  const node = findNodeByPath(tree, selectedPath);
  if (!node) return fallbackPath;
  return node.type === 'directory' ? node.path : getParentPath(node.path);
}

async function snapshotNode(workspace: string, node: TreeNode): Promise<FileSnapshot> {
  if (node.type === 'file') {
    const file = await fetchFile(workspace, node.path);
    return {
      kind: 'file',
      node,
      content: file.content,
      encoding: file.encoding,
    };
  }

  return {
    kind: 'directory',
    node,
    children: await Promise.all((node.children ?? []).map((child) => snapshotNode(workspace, child))),
  };
}

async function restoreSnapshot(workspace: string, snapshot: FileSnapshot): Promise<void> {
  if (snapshot.kind === 'file') {
    await saveFile(workspace, snapshot.node.path, snapshot.content, snapshot.encoding);
    return;
  }

  await mkdir(workspace, snapshot.node.path);
  for (const child of snapshot.children) {
    await restoreSnapshot(workspace, child);
  }
}

export function FileTree({ workspace, filterInputRef }: { workspace: string; filterInputRef?: React.RefObject<HTMLInputElement> }) {
  const { tree, loading, refresh } = useFileTree(workspace);
  const { openFile, activePath } = useEditor();
  const permission = useWorkspaceStore((s) => s.permission);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineAction, setInlineAction] = useState<InlineActionState | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const [fileFilter, setFileFilter] = useState('');
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(activePath ?? null);
  const historyRef = useRef<HistoryEntry[]>([]);
  const localFilterRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const resolvedFilterRef = filterInputRef ?? localFilterRef;
  const readOnly = permission !== 'write';

  useEffect(() => {
    if (activePath) setSelectedPath((current) => current ?? activePath);
  }, [activePath]);

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

  useEffect(() => {
    if (!deleteModal) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDeleteModal(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteModal]);

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      return target.matches('input, textarea, select') || target.isContentEditable;
    }

    async function undoLastAction() {
      const last = historyRef.current.at(-1);
      if (!last || readOnly) return;

      try {
        if (last.kind === 'rename') {
          await renamePath(workspace, last.to, last.from);
          setSelectedPath(last.from);
        } else {
          await restoreSnapshot(workspace, last.snapshot);
          setSelectedPath(last.snapshot.node.path);
        }
        await refresh();
        historyRef.current = historyRef.current.slice(0, -1);
      } catch {
        toast.error('Falha ao desfazer');
      }
    }

    function handleShortcut(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;

      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        void undoLastAction();
        return;
      }

      const selectedNode = selectedPath ? findNodeByPath(tree, selectedPath) : null;
      const fallbackNode = activePath ? findNodeByPath(tree, activePath) : null;
      const node = selectedNode ?? fallbackNode;

      if (!node) return;

      if (event.key === 'F2') {
        event.preventDefault();
        if (deleteModal || inlineAction) return;
        if (!readOnly) openInlineAction({ mode: 'rename', node, value: node.name });
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        if (deleteModal || inlineAction) return;
        if (!readOnly) openDeleteModal(node);
        return;
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [activePath, deleteModal, inlineAction, openDeleteModal, openInlineAction, readOnly, refresh, selectedPath, tree, workspace]);

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

    items.push({
      label: 'Copiar caminho',
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: () => {
        void navigator.clipboard?.writeText(node.path);
      },
    });

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

  async function uploadFilesToPath(targetPath: string, files: File[]) {
    if (files.length === 0) return;
    try {
      await Promise.all(
        files.map((file) => uploadFile(workspace, joinPath(targetPath, file.name), file)),
      );
      await refresh();
      toast.success(files.length === 1 ? 'Arquivo enviado' : `${files.length} arquivos enviados`);
    } catch {
      toast.error('Falha ao enviar arquivo');
    }
  }

  async function moveNodeToPath(sourcePath: string, targetPath: string) {
    const nextPath = joinPath(targetPath, getNodeName(sourcePath));
    if (sourcePath === nextPath) return;
    if (targetPath === sourcePath || targetPath.startsWith(`${sourcePath}/`)) {
      toast.error('Não é possível mover para dentro do próprio item');
      return;
    }

    try {
      await renamePath(workspace, sourcePath, nextPath);
      await refresh();
    } catch {
      toast.error('Falha ao mover item');
    }
  }

  function handleDragStart(node: TreeNode) {
    if (readOnly) return;
    setDraggingPath(node.path);
    setSelectedPath(node.path);
  }

  function handleDragEnd() {
    setDraggingPath(null);
    setDropTargetPath(null);
  }

  async function handleDrop(targetPath: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer?.files ?? []);
    setDropTargetPath(null);

    if (readOnly) return;

    if (files.length > 0) {
      await uploadFilesToPath(resolveUploadTargetPath(tree, selectedPath ?? activePath ?? null, targetPath), files);
      return;
    }

    if (draggingPath) {
      await moveNodeToPath(draggingPath, targetPath);
    }
    handleDragEnd();
  }

  function handleDirectoryDragOver(targetPath: string, event: DragEvent<HTMLElement>) {
    if (readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = event.dataTransfer.files.length > 0 ? 'copy' : 'move';
    }
    setDropTargetPath(targetPath);
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
        const nextPath = joinPath(getParentPath(inlineAction.node.path), nextValue);
        await renamePath(workspace, inlineAction.node.path, nextPath);
        historyRef.current = [
          ...historyRef.current,
          { kind: 'rename' as const, from: inlineAction.node.path, to: nextPath },
        ].slice(-20);
        await refresh();
        setSelectedPath(nextPath);
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
      const snapshot = await snapshotNode(workspace, node);

      await deleteFile(workspace, node.path);
      historyRef.current = [...historyRef.current, { kind: 'delete' as const, snapshot }].slice(-20);
      await refresh();
      setSelectedPath(null);
    } catch {
      toast.error('Falha ao excluir');
    } finally {
      setDeleteModal(null);
    }
  }

  const filteredFiles = useMemo(() => {
    const q = fileFilter.trim().toLowerCase();
    if (!q) return null;
    const results: TreeNode[] = [];
    function walk(nodes: TreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'file' && node.name.toLowerCase().includes(q)) results.push(node);
        if (node.children) walk(node.children);
      }
    }
    walk(tree);
    return results;
  }, [fileFilter, tree]);

  const showRootInlineInput =
    inlineAction && inlineAction.mode !== 'rename' && inlineAction.parentPath === '';
  const activeFileName = activePath?.split('/').pop() ?? activePath;

  return (
    <div
      className="relative flex h-full flex-col"
      style={{ background: 'var(--ide-sidebar-panel-background)', color: 'var(--ide-sidebar-panel-foreground)' }}
    >
      <div className="flex items-center justify-between border-b px-2 py-1.5" style={{ borderColor: 'var(--ide-panel-border)' }}>
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }}>
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
      <div className="relative border-b px-2 py-1.5" style={{ borderColor: 'var(--ide-panel-border)' }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }} />
        <Input
          ref={resolvedFilterRef}
          value={fileFilter}
          onChange={(e) => setFileFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.stopPropagation(); setFileFilter(''); }
          }}
          placeholder="Filtrar arquivos"
          className={cn('h-7 pl-7 text-xs', fileFilter ? 'pr-7' : '')}
        />
        {fileFilter && (
          <button
            type="button"
            aria-label="Limpar filtro"
            onClick={() => { setFileFilter(''); resolvedFilterRef.current?.focus(); }}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {activeFileName && filteredFiles === null && (
        <div className="border-b px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--ide-panel-border)', color: 'var(--ide-sidebar-panel-muted-foreground)' }}>
          <p>{`Arquivo ativo: ${activeFileName}`}</p>
          <p>Clique direito para ações</p>
        </div>
      )}
      <ScrollArea className="flex-1">
        {filteredFiles !== null ? (
          filteredFiles.length === 0 ? (
            <div className="space-y-1 p-3 text-xs" style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }}>
              <p>{`Nenhum arquivo corresponde a “${fileFilter.trim()}”.`}</p>
              <p>Use Esc ou o botão limpar para tentar outro filtro.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1 border-b px-3 py-2 text-[11px]" style={{ borderColor: 'var(--ide-panel-border)', color: 'var(--ide-sidebar-panel-muted-foreground)' }}>
                <p>{`${filteredFiles.length} ${filteredFiles.length === 1 ? 'arquivo encontrado' : 'arquivos encontrados'}`}</p>
                <p>Use Esc para limpar o filtro atual.</p>
              </div>
              <ul className="py-1">
                {filteredFiles.map((node) => (
                  <li key={node.path}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPath(node.path);
                        void openFile(node.path);
                      }}
                      title={node.path}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1 text-left text-xs hover:bg-accent',
                        activePath === node.path && 'bg-accent font-medium',
                      )}
                    >
                      <span className="truncate">{node.name}</span>
                      <span className="ml-auto truncate" style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }}>{node.path.slice(0, node.path.length - node.name.length).replace(/\/$/, '')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
          ) : loading ? (
            <p className="p-3 text-xs" style={{ color: 'var(--ide-sidebar-panel-muted-foreground)' }}>Carregando...</p>
        ) : tree.length === 0 && !showRootInlineInput ? (
          <div
            data-testid="file-tree-drop-root"
            className={cn(
              'p-3 text-xs text-muted-foreground',
              dropTargetPath === '' && 'rounded-md bg-accent/40 text-foreground',
            )}
            onDragOver={(event) => handleDirectoryDragOver('', event)}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setDropTargetPath((current) => (current === '' ? null : current));
            }}
            onDrop={(event) => void handleDrop('', event)}
          >
            Workspace vazio
          </div>
        ) : (
          <ul
            data-testid="file-tree-drop-root"
            className={cn('py-1', dropTargetPath === '' && 'rounded-md bg-accent/40')}
            onDragOver={(event) => handleDirectoryDragOver('', event)}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setDropTargetPath((current) => (current === '' ? null : current));
            }}
            onDrop={(event) => void handleDrop('', event)}
          >
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
                  setSelectedPath(node.path);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverDirectory={handleDirectoryDragOver}
                onDropIntoDirectory={(targetPath, event) => void handleDrop(targetPath, event)}
                dropTargetPath={dropTargetPath}
                inlineAction={inlineAction}
                onInlineValueChange={handleInlineValueChange}
                onInlineSubmit={() => void handleInlineSubmit()}
                onInlineCancel={handleInlineCancel}
                onSelectNode={(node) => setSelectedPath(node.path)}
                selectedPath={selectedPath ?? activePath ?? null}
                onRenameRequest={(node) => { if (!readOnly) openInlineAction({ mode: 'rename', node, value: node.name }); }}
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
                  setSelectedPath(node.path);
                }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverDirectory={handleDirectoryDragOver}
                onDropIntoDirectory={(targetPath, event) => void handleDrop(targetPath, event)}
                dropTargetPath={dropTargetPath}
                inlineAction={inlineAction}
                onInlineValueChange={handleInlineValueChange}
                onInlineSubmit={() => void handleInlineSubmit()}
                onInlineCancel={handleInlineCancel}
                onSelectNode={(node) => setSelectedPath(node.path)}
                selectedPath={selectedPath ?? activePath ?? null}
                onRenameRequest={(node) => { if (!readOnly) openInlineAction({ mode: 'rename', node, value: node.name }); }}
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
