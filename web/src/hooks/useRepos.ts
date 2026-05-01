import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cloneRepo as apiClone, deleteLocalRepo as apiDelete, initRepo as apiInit, listRepos } from '@/api/repos';
import type { LocalRepo, RemoteRepo } from '@/types';

const REPOS_PAGE_SIZE = 10;

export function useRepos() {
  const [githubRepos, setGithubRepos] = useState<RemoteRepo[]>([]);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreGithub, setLoadingMoreGithub] = useState(false);
  const [loadingMoreLocal, setLoadingMoreLocal] = useState(false);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [githubPage, setGithubPage] = useState(1);
  const [localPage, setLocalPage] = useState(1);
  const [hasMoreGithub, setHasMoreGithub] = useState(false);
  const [hasMoreLocal, setHasMoreLocal] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRepos({ githubPage: 1, localPage: 1, limit: REPOS_PAGE_SIZE });
      setGithubRepos(data.githubRepos);
      setLocalRepos(data.localRepos);
      setGithubPage(data.githubPagination.page);
      setLocalPage(data.localPagination.page);
      setHasMoreGithub(data.githubPagination.hasMore);
      setHasMoreLocal(data.localPagination.hasMore);
    } catch {
      toast.error('Falha ao carregar repositórios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadMoreGithub = useCallback(async () => {
    if (loading || loadingMoreGithub || !hasMoreGithub) return;
    setLoadingMoreGithub(true);
    try {
      const nextPage = githubPage + 1;
      const data = await listRepos({ githubPage: nextPage, localPage: localPage, limit: REPOS_PAGE_SIZE });
      setGithubRepos((prev) => [...prev, ...data.githubRepos]);
      setGithubPage(data.githubPagination.page);
      setHasMoreGithub(data.githubPagination.hasMore);
    } catch {
      toast.error('Falha ao carregar mais repositórios do GitHub');
    } finally {
      setLoadingMoreGithub(false);
    }
  }, [githubPage, hasMoreGithub, loading, loadingMoreGithub, localPage]);

  const loadMoreLocal = useCallback(async () => {
    if (loading || loadingMoreLocal || !hasMoreLocal) return;
    setLoadingMoreLocal(true);
    try {
      const nextPage = localPage + 1;
      const data = await listRepos({ githubPage: githubPage, localPage: nextPage, limit: REPOS_PAGE_SIZE });
      setLocalRepos((prev) => [...prev, ...data.localRepos]);
      setLocalPage(data.localPagination.page);
      setHasMoreLocal(data.localPagination.hasMore);
    } catch {
      toast.error('Falha ao carregar mais repositórios locais');
    } finally {
      setLoadingMoreLocal(false);
    }
  }, [githubPage, hasMoreLocal, loading, loadingMoreLocal, localPage]);

  const clone = useCallback(
    async (repo: RemoteRepo, branch?: string) => {
      setCloningId(repo.id);
      try {
        const result = await apiClone(repo.fullName, branch ?? repo.defaultBranch);
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

  const init = useCallback(async (repoName: string, defaultBranch?: string): Promise<LocalRepo> => {
    const result = await apiInit(repoName, defaultBranch);
    setLocalRepos((prev) =>
      prev.some((r) => r.id === result.repo.id)
        ? prev
        : [result.repo, ...prev],
    );
    return result.repo;
  }, []);

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

  return {
    githubRepos,
    localRepos,
    loading,
    loadingMoreGithub,
    loadingMoreLocal,
    hasMoreGithub,
    hasMoreLocal,
    cloningId,
    refresh,
    loadMoreGithub,
    loadMoreLocal,
    clone,
    init,
    remove,
  };
}
