import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { fetchTree } from '@/api/fs';
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

  return { tree, loading, refresh };
}
