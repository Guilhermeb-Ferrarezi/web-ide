import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Download, ExternalLink, Lock, LogOut, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRepos } from '@/hooks/useRepos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { repos, loading, cloningId, clone, remove } = useRepos();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [repos, query]);

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
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">Nenhum repositório encontrado.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((repo) => (
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
                    {repo.cloned && <Badge variant="outline">clonado</Badge>}
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
                  {repo.cloned ? (
                    <>
                      <Button size="sm" onClick={() => navigate(`/ide/${repo.name}`)}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => void remove(repo)}
                        title="Remover do disco"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cloningId === repo.id}
                      onClick={() => void clone(repo)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {cloningId === repo.id ? 'Clonando...' : 'Clonar'}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
