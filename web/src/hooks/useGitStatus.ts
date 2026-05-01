import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchStatus } from '@/api/git';
import { watcherBus } from '@/lib/watcherBus';
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
  }, [refresh]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return watcherBus.subscribe((e) => {
      if (e.kind !== 'fs' && e.kind !== 'git') return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void refresh(), 250);
    });
  }, [refresh]);

  return { status, loading, refresh };
}
