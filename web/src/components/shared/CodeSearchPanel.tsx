import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { searchFiles } from '@/api/fs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEditor } from '@/hooks/useEditor';
import type { CodeSearchResult } from '@/types';

type Props = {
  workspace: string;
};

export function CodeSearchPanel({ workspace }: Props) {
  const { openFile } = useEditor();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    try {
      const nextResults = await searchFiles(workspace, trimmed);
      setResults(nextResults);
      setSearched(true);
    } catch {
      toast.error('Falha ao buscar no código');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-2 py-2">
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSearch();
            }}
            placeholder="Buscar no código"
            className="h-8 text-sm"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void handleSearch()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-2">
          {!searched && !loading && (
            <p className="text-xs text-muted-foreground">Digite um trecho e pressione Enter para procurar no workspace.</p>
          )}
          {searched && results.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">Nenhum resultado encontrado.</p>
          )}
          {results.map((result) => (
            <div key={result.path} className="rounded-md border bg-muted/10">
              <button
                type="button"
                className="w-full border-b px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                onClick={() => void openFile(result.path)}
              >
                {result.path}
              </button>
              <ul className="py-1">
                {result.matches.map((match) => (
                  <li key={`${result.path}:${match.line}:${match.column}`}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                      onClick={() => void openFile(result.path)}
                    >
                      <span className="min-w-10 font-mono text-muted-foreground">{match.line}</span>
                      <span className="truncate font-mono text-foreground/90">{match.preview}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
