import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Download, ExternalLink, Lock, LogOut, Search, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useRepos } from '@/hooks/useRepos';
import { grantRepoAccess, listRepoPermissions, revokeRepoAccess, searchShareUsers } from '@/api/repos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RepoPermissionEntry, ShareUserCandidate } from '@/types';

const REPOS_PAGE_SIZE = 10;

function formatRelative(iso: string | null) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return 'hoje';
  if (days < 30) return `${days}d atrás`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}m atrás`;
  return `${Math.floor(months / 12)}a atrás`;
}

export default function ReposPage() {
  const { user, logout } = useAuth();
  const { githubRepos, localRepos, loading, cloningId, clone, remove } = useRepos();
  const [query, setQuery] = useState('');
  const [sharingRepoId, setSharingRepoId] = useState<string | null>(null);
  const [shareLogin, setShareLogin] = useState('');
  const [sharePermission, setSharePermission] = useState<'read' | 'write'>('read');
  const [shareBusy, setShareBusy] = useState(false);
  const [permissionsByRepo, setPermissionsByRepo] = useState<Record<string, RepoPermissionEntry[]>>({});
  const [shareCandidates, setShareCandidates] = useState<ShareUserCandidate[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [visibleLocalCount, setVisibleLocalCount] = useState(REPOS_PAGE_SIZE);
  const [visibleGithubCount, setVisibleGithubCount] = useState(REPOS_PAGE_SIZE);
  const localSentinelRef = useRef<HTMLDivElement | null>(null);
  const githubSentinelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sharingRepoId) return;
    void (async () => {
      try {
        const data = await listRepoPermissions(sharingRepoId);
        setPermissionsByRepo((prev) => ({ ...prev, [sharingRepoId]: data }));
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? 'Falha ao carregar acessos');
      }
    })();
  }, [sharingRepoId]);

  useEffect(() => {
    if (!sharingRepoId) {
      setShareCandidates([]);
      setSearchingUsers(false);
      return;
    }

    const query = shareLogin.trim().replace(/^@/, '');
    if (query.length < 2) {
      setShareCandidates([]);
      setSearchingUsers(false);
      return;
    }

    let cancelled = false;
    setSearchingUsers(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await searchShareUsers(sharingRepoId, query);
          if (!cancelled) setShareCandidates(data);
        } catch (err: any) {
          if (!cancelled) {
            setShareCandidates([]);
            toast.error(err?.response?.data?.message ?? 'Falha ao buscar usuarios');
          }
        } finally {
          if (!cancelled) setSearchingUsers(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      setSearchingUsers(false);
      window.clearTimeout(timeoutId);
    };
  }, [shareLogin, sharingRepoId]);

  const filteredGithub = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return githubRepos;
    return githubRepos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [githubRepos, query]);

  const filteredLocal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return localRepos;
    return localRepos.filter((r) => r.slug.toLowerCase().includes(q) || r.githubFullName.toLowerCase().includes(q));
  }, [localRepos, query]);

  useEffect(() => {
    setVisibleLocalCount(REPOS_PAGE_SIZE);
  }, [query, localRepos]);

  useEffect(() => {
    setVisibleGithubCount(REPOS_PAGE_SIZE);
  }, [query, githubRepos]);

  useEffect(() => {
    const node = localSentinelRef.current;
    if (!node || visibleLocalCount >= filteredLocal.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setVisibleLocalCount((count) => Math.min(count + REPOS_PAGE_SIZE, filteredLocal.length));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredLocal.length, visibleLocalCount]);

  useEffect(() => {
    const node = githubSentinelRef.current;
    if (!node || visibleGithubCount >= filteredGithub.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      setVisibleGithubCount((count) => Math.min(count + REPOS_PAGE_SIZE, filteredGithub.length));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredGithub.length, visibleGithubCount]);

  async function handleGrant(repoId: string) {
    const login = shareLogin.trim().replace(/^@/, '');
    if (!login) return toast.warning('Informe o login do GitHub');
    setShareBusy(true);
    try {
      await grantRepoAccess(repoId, login, sharePermission);
      const data = await listRepoPermissions(repoId);
      setPermissionsByRepo((prev) => ({ ...prev, [repoId]: data }));
      setShareLogin('');
      setSharePermission('read');
      setShareCandidates([]);
      toast.success(`Acesso concedido para @${login}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha ao compartilhar');
    } finally {
      setShareBusy(false);
    }
  }

  async function handleRevoke(repoId: string, userId: string, login: string | null) {
    setShareBusy(true);
    try {
      await revokeRepoAccess(repoId, userId);
      const data = await listRepoPermissions(repoId);
      setPermissionsByRepo((prev) => ({ ...prev, [repoId]: data }));
      toast.success(`Acesso removido${login ? ` de @${login}` : ''}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Falha ao remover acesso');
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.avatarUrl && (
            <img src={user.avatarUrl} alt={user.login} className="h-9 w-9 rounded-full border" />
          )}
          <div>
            <h1 className="text-xl font-semibold">Repositórios</h1>
            <p className="text-sm text-muted-foreground">@{user?.login}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </header>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar repositório..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">Compartilhados comigo</h2>
              <span className="text-xs text-muted-foreground">{filteredLocal.length}</span>
            </div>
            {filteredLocal.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum repositório local acessível.</p>
            ) : (
              <ul className="space-y-2">
                {filteredLocal.slice(0, visibleLocalCount).map((repo) => (
                  <li key={repo.id}>
                    <Card className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{repo.slug}</h3>
                          <Badge variant={repo.permission === 'write' ? 'default' : 'secondary'}>{repo.permission}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{repo.githubFullName}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" onClick={() => navigate(`/ide/${repo.slug}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir
                        </Button>
                        {(repo.canManage || user?.role === 'admin' || user?.role === 'owner') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSharingRepoId((current) => (current === repo.id ? null : repo.id))}
                          >
                            <Share2 className="mr-2 h-4 w-4" />
                            Compartilhar
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => void remove(repo)}
                          title="Remover da minha lista"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                    {sharingRepoId === repo.id && (
                      <Card className="mt-2 space-y-3 p-4">
                        <div className="flex flex-col gap-2 md:flex-row">
                          <div className="relative flex-1">
                            <Input
                              value={shareLogin}
                              onChange={(e) => setShareLogin(e.target.value)}
                              placeholder="login do GitHub"
                            />
                            {(searchingUsers || shareCandidates.length > 0) && (
                              <div className="absolute z-10 mt-2 max-h-64 w-full overflow-auto rounded-md border bg-background shadow-md">
                                {shareCandidates.map((candidate) => (
                                  <button
                                    key={candidate.userId}
                                    type="button"
                                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                                    onClick={() => {
                                      setShareLogin(candidate.login);
                                      setShareCandidates([]);
                                    }}
                                  >
                                    {candidate.avatarUrl ? (
                                      <img
                                        src={candidate.avatarUrl}
                                        alt={candidate.login}
                                        className="h-8 w-8 rounded-full border"
                                      />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full border bg-muted" />
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">@{candidate.login}</p>
                                    </div>
                                  </button>
                                ))}
                                {searchingUsers && (
                                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando usuarios...</p>
                                )}
                              </div>
                            )}
                          </div>
                          <select
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={sharePermission}
                            onChange={(e) => setSharePermission(e.target.value as 'read' | 'write')}
                          >
                            <option value="read">read</option>
                            <option value="write">write</option>
                          </select>
                          <Button disabled={shareBusy} onClick={() => void handleGrant(repo.id)}>
                            Conceder acesso
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {(permissionsByRepo[repo.id] ?? []).map((entry) => (
                            <div key={entry.userId} className="flex items-center justify-between rounded-md border p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">@{entry.login ?? entry.userId}</p>
                                <p className="text-xs text-muted-foreground">{entry.permission}</p>
                              </div>
                              {entry.userId !== user?.userId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={shareBusy}
                                  onClick={() => void handleRevoke(repo.id, entry.userId, entry.login)}
                                >
                                  Remover
                                </Button>
                              )}
                            </div>
                          ))}
                          {(permissionsByRepo[repo.id] ?? []).length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhum acesso extra concedido.</p>
                          )}
                        </div>
                      </Card>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {visibleLocalCount < filteredLocal.length && <div ref={localSentinelRef} className="h-4" aria-hidden="true" />}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">GitHub</h2>
              <span className="text-xs text-muted-foreground">{filteredGithub.length}</span>
            </div>
            {filteredGithub.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Nenhum repositório encontrado.</p>
            ) : (
              <ul className="space-y-2">
                {filteredGithub.slice(0, visibleGithubCount).map((repo) => (
                  <li key={repo.id}>
                    <Card className="flex items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{repo.name}</h3>
                          {repo.private && (
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="h-3 w-3" /> private
                            </Badge>
                          )}
                          {repo.cloned && <Badge variant="outline">importado</Badge>}
                        </div>
                        {repo.description && (
                          <p className="mt-1 truncate text-sm text-muted-foreground">{repo.description}</p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <Code2 className="h-3 w-3" /> {repo.language}
                            </span>
                          )}
                          <span>{formatRelative(repo.updatedAt)}</span>
                          <span className="font-mono">{repo.defaultBranch}</span>
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant={repo.cloned ? 'secondary' : 'outline'}
                          disabled={cloningId === repo.id}
                          onClick={() => void clone(repo)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {cloningId === repo.id ? 'Importando...' : repo.cloned ? 'Adicionar acesso' : 'Importar'}
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            {visibleGithubCount < filteredGithub.length && <div ref={githubSentinelRef} className="h-4" aria-hidden="true" />}
          </section>
        </div>
      )}
    </div>
  );
}
