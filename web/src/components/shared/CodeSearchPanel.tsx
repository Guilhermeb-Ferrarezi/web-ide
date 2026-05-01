import { useMemo, useState } from 'react';
import { CaseSensitive, ChevronDown, ChevronRight, Loader2, Regex, WholeWord } from 'lucide-react';
import { toast } from 'sonner';
import { searchFiles } from '@/api/fs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditor } from '@/hooks/useEditor';
import { cn } from '@/lib/utils';
import type { CodeSearchMatch, CodeSearchOptions, CodeSearchResult } from '@/types';

type Props = {
  workspace: string;
};

export function CodeSearchPanel({ workspace }: Props) {
  const { openFile } = useEditor();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CodeSearchOptions>({});
  const [results, setResults] = useState<CodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const totalMatches = useMemo(
    () => results.reduce((sum, result) => sum + result.matches.length, 0),
    [results],
  );

  async function runSearch(nextOptions: CodeSearchOptions = options, nextQuery: string = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }

    if (nextOptions.regex) {
      try {
        new RegExp(trimmed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Expressão regular inválida');
        setResults([]);
        setSearched(true);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const next = await searchFiles(workspace, trimmed, nextOptions);
      setResults(next);
      setSearched(true);
      setCollapsed({});
    } catch {
      toast.error('Falha ao buscar no código');
    } finally {
      setLoading(false);
    }
  }

  function toggleOption(key: keyof CodeSearchOptions) {
    const next = { ...options, [key]: !options[key] };
    setOptions(next);
    if (query.trim()) void runSearch(next);
  }

  function toggleCollapsed(path: string) {
    setCollapsed((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b px-2 py-2">
        <div className="relative">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void runSearch();
            }}
            placeholder="Buscar"
            className="h-8 pr-24 text-sm"
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            <ToggleIcon
              active={!!options.caseSensitive}
              label="Diferenciar maiúsculas (Aa)"
              onClick={() => toggleOption('caseSensitive')}
            >
              <CaseSensitive className="h-3.5 w-3.5" />
            </ToggleIcon>
            <ToggleIcon
              active={!!options.wholeWord}
              label="Palavra inteira"
              onClick={() => toggleOption('wholeWord')}
            >
              <WholeWord className="h-3.5 w-3.5" />
            </ToggleIcon>
            <ToggleIcon
              active={!!options.regex}
              label="Expressão regular"
              onClick={() => toggleOption('regex')}
            >
              <Regex className="h-3.5 w-3.5" />
            </ToggleIcon>
          </div>
        </div>
        <div className="flex h-5 items-center justify-between text-[11px] text-muted-foreground">
          <span>
            {loading
              ? 'Buscando…'
              : error
                ? <span className="text-destructive">{error}</span>
                : searched && totalMatches > 0
                  ? `${totalMatches} ${totalMatches === 1 ? 'resultado' : 'resultados'} em ${results.length} ${results.length === 1 ? 'arquivo' : 'arquivos'}`
                  : ''}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {!searched && !loading && !error && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Digite um trecho e pressione Enter para procurar no workspace.
            </p>
          )}
          {searched && !loading && !error && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum resultado encontrado.</p>
          )}
          {results.map((result) => {
            const isCollapsed = collapsed[result.path];
            const fileName = result.path.split('/').pop() ?? result.path;
            const dir = result.path.slice(0, result.path.length - fileName.length).replace(/\/$/, '');
            return (
              <div key={result.path}>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(result.path)}
                  className="flex w-full items-center gap-1 px-2 py-1 text-left text-xs hover:bg-accent"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{fileName}</span>
                  {dir && <span className="truncate text-muted-foreground">{dir}</span>}
                  <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {result.matches.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul>
                    {result.matches.map((match) => (
                      <li key={`${result.path}:${match.line}:${match.column}`}>
                        <button
                          type="button"
                          onClick={() => void openFile(result.path, { line: match.line, column: match.column })}
                          className="flex w-full items-start gap-2 px-2 py-0.5 pl-6 text-left text-xs hover:bg-accent"
                          title={`Linha ${match.line}, coluna ${match.column}`}
                        >
                          <MatchPreview match={match} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function ToggleIcon({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground',
        active && 'bg-accent text-foreground ring-1 ring-inset ring-border',
      )}
    >
      {children}
    </Button>
  );
}

function MatchPreview({ match }: { match: CodeSearchMatch }) {
  const start = Math.max(0, match.previewOffset);
  const end = Math.min(match.preview.length, start + match.length);
  const before = match.preview.slice(0, start);
  const hit = match.preview.slice(start, end);
  const after = match.preview.slice(end);
  return (
    <span className="block truncate font-mono text-foreground/90">
      {before}
      <span className="rounded-sm bg-yellow-500/30 px-0.5 text-foreground">{hit}</span>
      {after}
    </span>
  );
}
