import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cloneRepo as apiClone, deleteLocalRepo as apiDelete, listRemoteRepos } from '@/api/repos';
import type { RemoteRepo } from '@/types';

export function useRepos() {
  const [repos, setRepos] = useState<RemoteRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRemoteRepos();
      setRepos(data);
    } catch {
      toast.error('Falha ao carregar repositórios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clone = useCallback(
    async (repo: RemoteRepo) => {
      setCloningId(repo.id);
      try {
        await apiClone(repo.fullName, repo.defaultBranch);
        toast.success(`${repo.name} clonado`);
        setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, cloned: true } : r)));
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 409) toast.warning('Repositório já está clonado');
        else toast.error('Falha ao clonar');
      } finally {
        setCloningId(null);
      }
    },
    [],
  );

  const remove = useCallback(async (repo: RemoteRepo) => {
    try {
      await apiDelete(repo.name);
      toast.success(`${repo.name} removido`);
      setRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, cloned: false } : r)));
    } catch {
      toast.error('Falha ao remover');
    }
  }, []);

  return { repos, loading, cloningId, refresh, clone, remove };
}
