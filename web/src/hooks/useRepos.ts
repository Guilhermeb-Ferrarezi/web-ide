import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cloneRepo as apiClone, deleteLocalRepo as apiDelete, listRepos } from '@/api/repos';
import type { LocalRepo, RemoteRepo } from '@/types';

export function useRepos() {
  const [githubRepos, setGithubRepos] = useState<RemoteRepo[]>([]);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRepos();
      setGithubRepos(data.githubRepos);
      setLocalRepos(data.localRepos);
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
        const result = await apiClone(repo.fullName, repo.defaultBranch);
        toast.success(`${repo.name} clonado`);
        setGithubRepos((prev) => prev.map((r) => (r.id === repo.id ? { ...r, cloned: true } : r)));
        setLocalRepos((prev) =>
          prev.some((r) => r.id === result.repo.id)
            ? prev
            : [...prev, result.repo].sort((a, b) => a.githubFullName.localeCompare(b.githubFullName)),
        );
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

  const remove = useCallback(async (repo: LocalRepo) => {
    try {
      await apiDelete(repo.slug);
      toast.success(`${repo.githubFullName} removido da sua lista`);
      setLocalRepos((prev) => prev.filter((r) => r.id !== repo.id));
      setGithubRepos((prev) => prev.map((r) => (r.fullName === repo.githubFullName ? { ...r, cloned: false } : r)));
    } catch {
      toast.error('Falha ao remover');
    }
  }, []);

  return { githubRepos, localRepos, loading, cloningId, refresh, clone, remove };
}
