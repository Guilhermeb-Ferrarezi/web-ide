import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, Loader2, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useGitStatus } from '@/hooks/useGitStatus';
import { useEditor } from '@/hooks/useEditor';
import { fetchBranches, gitAdd, gitCommit, gitPull, gitPush, gitUnstage, gitUntrack } from '@/api/git';
import { cn } from '@/lib/utils';
import { GitFileList } from './GitFileList';

type Props = { workspace: string; readOnly?: boolean };

export function GitPanel({ workspace, readOnly = false }: Props) {
  const { status, loading, refresh } = useGitStatus(workspace);
  const { openFile } = useEditor();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'commit' | 'push' | 'pull' | null>(null);
  const [branchOptions, setBranchOptions] = useState<string[]>([]);
  const [targetBranch, setTargetBranch] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const branches = await fetchBranches(workspace);
        if (cancelled) return;
        setBranchOptions(branches.all);
        setTargetBranch(branches.current);
      } catch {
        if (cancelled) return;
        setBranchOptions([]);
        setTargetBranch('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspace]);

  useEffect(() => {
    if (!status?.branch) return;
    setTargetBranch((current) => current || status.branch || '');
    setBranchOptions((current) => (status.branch && !current.includes(status.branch) ? [status.branch, ...current] : current));
  }, [status?.branch]);

  const stagedItems = useMemo(
    () => status?.staged.map((f) => ({ path: f.path, tag: f.index.trim() || 'M' })) ?? [],
    [status],
  );
  const unstagedItems = useMemo(
    () => [
      ...(status?.unstaged.map((f) => ({ path: f.path, tag: f.workingDir.trim() || 'M' })) ?? []),
      ...(status?.untracked.map((p) => ({ path: p, tag: '?' })) ?? []),
    ],
    [status],
  );
  const trackedPaths = useMemo(
    () => Array.from(new Set([...(status?.staged.map((f) => f.path) ?? []), ...(status?.unstaged.map((f) => f.path) ?? [])])),
    [status],
  );

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const toggleAll = (items: { path: string }[]) =>
    setSelected((prev) => {
      const all = items.every((i) => prev.has(i.path));
      const next = new Set(prev);
      items.forEach((i) => (all ? next.delete(i.path) : next.add(i.path)));
      return next;
    });

  async function handleStage() {
    const files = unstagedItems.filter((f) => selected.has(f.path)).map((f) => f.path);
    if (files.length === 0) return;
    try {
      await gitAdd(workspace, files);
      setSelected(new Set());
      await refresh();
    } catch {
      toast.error('Falha ao adicionar');
    }
  }

  async function handleUnstage() {
    const files = stagedItems.filter((f) => selected.has(f.path)).map((f) => f.path);
    if (files.length === 0) return;
    try {
      await gitUnstage(workspace, files);
      setSelected(new Set());
      await refresh();
    } catch {
      toast.error('Falha ao desfazer stage');
    }
  }

  async function handleUntrack() {
    const files = trackedPaths.filter((path) => selected.has(path));
    if (files.length === 0) return;
    try {
      await gitUntrack(workspace, files);
      setSelected(new Set());
      toast.success('Arquivos removidos do rastreamento');
      await refresh();
    } catch {
      toast.error('Falha ao remover arquivos do Git');
    }
  }

  async function handleCommit() {
    if (!message.trim()) return toast.warning('Mensagem obrigatória');
    setBusy('commit');
    try {
      await gitCommit(workspace, message.trim(), targetBranch || undefined);
      setMessage('');
      toast.success('Commit criado');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha no commit');
    } finally {
      setBusy(null);
    }
  }

  async function handlePush() {
    setBusy('push');
    try {
      await gitPush(workspace);
      toast.success('Push concluído');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha no push');
    } finally {
      setBusy(null);
    }
  }

  async function handlePull() {
    setBusy('pull');
    try {
      await gitPull(workspace);
      toast.success('Pull concluído');
      await refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha no pull');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <div className="flex items-center gap-2 text-xs">
          <GitBranch className="h-3.5 w-3.5" />
          <span className="font-mono">{status?.branch ?? '—'}</span>
          {status && (status.ahead > 0 || status.behind > 0) && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {status.ahead > 0 && <><ArrowUp className="mr-0.5 h-3 w-3" />{status.ahead}</>}
              {status.behind > 0 && <><ArrowDown className="mr-0.5 h-3 w-3" />{status.behind}</>}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => void refresh()} disabled={loading}>
          <RefreshCcw className={loading ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 py-2">
          {readOnly && (
            <div className="mx-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-sm font-medium text-foreground">Somente leitura</p>
              <p className="text-xs text-muted-foreground">
                Commits, stage, push e pull ficam bloqueados para quem tem acesso read.
              </p>
            </div>
          )}
          {!readOnly && (stagedItems.length > 0 || unstagedItems.length > 0) && (
            <div className="flex gap-2 px-2">
              {unstagedItems.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={async () => {
                    const files = unstagedItems.map((f) => f.path);
                    try { await gitAdd(workspace, files); await refresh(); setSelected(new Set()); }
                    catch { toast.error('Falha ao adicionar todos'); }
                  }}
                >
                  Stage todos ({unstagedItems.length})
                </Button>
              )}
              {stagedItems.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={async () => {
                    const files = stagedItems.map((f) => f.path);
                    try { await gitUnstage(workspace, files); await refresh(); setSelected(new Set()); }
                    catch { toast.error('Falha ao desfazer stage de todos'); }
                  }}
                >
                  Unstage todos ({stagedItems.length})
                </Button>
              )}
            </div>
          )}
          {stagedItems.length > 0 && (
            <>
              <GitFileList
                title="Staged"
                items={stagedItems}
                selected={selected}
                onToggle={toggle}
                onToggleAll={() => toggleAll(stagedItems)}
                emptyText=""
                onOpenFile={(path) => void openFile(path)}
              />
              <div className="px-2">
                <Button size="sm" variant="outline" className="w-full" onClick={() => void handleUnstage()} disabled={readOnly}>
                  Unstage selecionados
                </Button>
              </div>
              <Separator />
            </>
          )}

          {unstagedItems.length > 0 ? (
            <>
              <GitFileList
                title="Modificados"
                items={unstagedItems}
                selected={selected}
                onToggle={toggle}
                onToggleAll={() => toggleAll(unstagedItems)}
                emptyText=""
                onOpenFile={(path) => void openFile(path)}
              />
              <div className="px-2">
                <Button size="sm" className="w-full" onClick={() => void handleStage()} disabled={readOnly}>
                  Adicionar selecionados (stage)
                </Button>
              </div>
            </>
          ) : (
            stagedItems.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sem mudanças</p>
            )
          )}
          {trackedPaths.length > 0 && (
            <>
              <Separator />
              <div className="px-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => void handleUntrack()}
                  disabled={readOnly || trackedPaths.every((path) => !selected.has(path))}
                >
                  Tirar selecionados do Git
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Remove do índice, mas mantém os arquivos no disco.
                </p>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t p-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="git-commit-branch">
            Branch do commit
          </label>
          <select
            id="git-commit-branch"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
            disabled={readOnly || busy !== null || branchOptions.length === 0}
          >
            {branchOptions.length === 0 ? (
              <option value="">Sem branches disponíveis</option>
            ) : (
              branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Ctrl+Enter para commitar · Esc limpa a mensagem</span>
            {message.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => {
                  setMessage('');
                  document.getElementById('git-commit-message')?.focus();
                }}
                disabled={readOnly}
                aria-label="Limpar mensagem do commit"
              >
                Limpar
              </Button>
            ) : null}
          </div>
          <div className="relative">
            <Textarea
              id="git-commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleCommit();
                }
                if (e.key === 'Escape' && message) {
                  e.preventDefault();
                  setMessage('');
                  e.currentTarget.focus();
                }
              }}
              placeholder="Mensagem do commit"
              rows={3}
              className="text-sm"
              disabled={readOnly}
            />
            {message.length > 0 && (
              <span
                className={cn(
                  'pointer-events-none absolute bottom-2 right-2 text-[10px] tabular-nums',
                  message.length > 72
                    ? 'text-destructive'
                    : message.length > 50
                      ? 'text-yellow-500'
                      : 'text-muted-foreground/60',
                )}
              >
                {message.length}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy !== null || readOnly || !message.trim()} onClick={() => void handleCommit()}>
            {busy === 'commit' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Commit
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || readOnly} onClick={() => void handlePush()}>
            {busy === 'push' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="mr-1 h-3.5 w-3.5" />}
            Push
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || readOnly} onClick={() => void handlePull()}>
            {busy === 'pull' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ArrowDown className="mr-1 h-3.5 w-3.5" />}
            Pull
          </Button>
        </div>
      </div>
    </div>
  );
}
