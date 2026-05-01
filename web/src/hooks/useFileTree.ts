import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { fetchTree } from '@/api/fs';
import { watcherBus } from '@/lib/watcherBus';
import type { TreeNode } from '@/types';

export function useFileTree(workspace: string | null) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await fetchTree(workspace);
      setTree(data);
    } catch {
      toast.error('Falha ao carregar árvore de arquivos');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return watcherBus.subscribe((e) => {
      if (e.kind !== 'fs') return;
      if (e.event === 'change') return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void refresh(), 200);
    });
  }, [refresh]);

  return { tree, loading, refresh };
}
