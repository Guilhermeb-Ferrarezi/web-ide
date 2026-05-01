import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useGitStatus } from '@/hooks/useGitStatus';
import { gitAdd, gitCommit, gitPull, gitPush, gitUnstage } from '@/api/git';
import { GitFileList } from './GitFileList';

type Props = { workspace: string };

export function GitPanel({ workspace }: Props) {
  const { status, loading, refresh } = useGitStatus(workspace);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'commit' | 'push' | 'pull' | null>(null);

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

  async function handleCommit() {
    if (!message.trim()) return toast.warning('Mensagem obrigatória');
    setBusy('commit');
    try {
      await gitCommit(workspace, message.trim());
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
          {stagedItems.length > 0 && (
            <>
              <GitFileList
                title="Staged"
                items={stagedItems}
                selected={selected}
                onToggle={toggle}
                onToggleAll={() => toggleAll(stagedItems)}
                emptyText=""
              />
              <div className="px-2">
                <Button size="sm" variant="outline" className="w-full" onClick={() => void handleUnstage()}>
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
              />
              <div className="px-2">
                <Button size="sm" className="w-full" onClick={() => void handleStage()}>
                  Adicionar selecionados (stage)
                </Button>
              </div>
            </>
          ) : (
            stagedItems.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">Sem mudanças</p>
            )
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t p-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Mensagem do commit"
          rows={3}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={busy !== null} onClick={() => void handleCommit()}>
            {busy === 'commit' ? '...' : 'Commit'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void handlePush()}>
            <ArrowUp className="mr-1 h-3.5 w-3.5" />
            {busy === 'push' ? '...' : 'Push'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void handlePull()}>
            <ArrowDown className="mr-1 h-3.5 w-3.5" />
            {busy === 'pull' ? '...' : 'Pull'}
          </Button>
        </div>
      </div>
    </div>
  );
}
