import { useCallback, useEffect, useState } from 'react';
import { fetchStatus } from '@/api/git';
import type { GitStatus } from '@/types';

export function useGitStatus(workspace: string | null) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await fetchStatus(workspace);
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return { status, loading, refresh };
}
