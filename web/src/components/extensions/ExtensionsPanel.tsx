import { useEffect, useMemo, useState } from 'react';
import { Blocks, RefreshCcw, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getExtensionDetail, searchExtensions } from '@/api/extensions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEditorStore } from '@/stores/editorStore';
import { useAppearanceStore } from '@/stores/appearanceStore';
import type { MarketplaceExtension } from '@/types';

type InstalledEntry = {
  extensionId: string;
  displayName: string;
  publisher: string;
  description: string;
  iconUrl: string | null;
};

type SidebarItem = {
  extensionId: string;
  displayName: string;
  description: string | null;
  publisher: string;
  iconUrl: string | null;
  verified?: boolean;
};

function SidebarSection({
  title,
  count,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  count?: number;
  items: SidebarItem[];
  selectedId: string | null;
  onSelect: (extensionId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="border-b border-border/60">
      <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        {typeof count === 'number' ? (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{count}</span>
        ) : null}
      </div>

      {items.map((item) => (
        <div
          key={`${title}-${item.extensionId}`}
          role="button"
          tabIndex={0}
          className={cn(
            'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-accent/30',
            selectedId === item.extensionId && 'bg-accent/50',
          )}
          onClick={() => onSelect(item.extensionId)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(item.extensionId);
            }
          }}
        >
          {item.iconUrl ? (
            <img src={item.iconUrl} alt={item.displayName} className="h-10 w-10 rounded-md border object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
              <Blocks className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{item.displayName}</p>
              {item.verified ? <ShieldCheck className="h-3.5 w-3.5 text-sky-400" /> : null}
            </div>
            {item.description ? (
              <p className="truncate text-xs text-muted-foreground">{item.description}</p>
            ) : null}
            <p className="truncate text-xs text-muted-foreground">{item.publisher}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

export function ExtensionsPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketplaceExtension[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const installedThemes = useAppearanceStore((state) => state.installedThemes);
  const installedIconThemes = useAppearanceStore((state) => state.installedIconThemes);
  const openTab = useEditorStore((state) => state.openTab);

  const installedEntries = useMemo<InstalledEntry[]>(() => {
    const themeEntries = installedThemes.map((theme) => ({
      extensionId: theme.extensionId,
      displayName: theme.label,
      publisher: theme.extensionId.split('.')[0] ?? '',
      description: 'Installed color theme',
      iconUrl: null,
    }));
    const iconEntries = installedIconThemes.map((theme) => ({
      extensionId: theme.extensionId,
      displayName: theme.label,
      publisher: theme.extensionId.split('.')[0] ?? '',
      description: 'Installed file icon theme',
      iconUrl: null,
    }));

    return [...themeEntries, ...iconEntries].filter(
      (entry, index, array) => array.findIndex((item) => item.extensionId === entry.extensionId) === index,
    );
  }, [installedIconThemes, installedThemes]);

  const installedItems = useMemo<SidebarItem[]>(
    () =>
      installedEntries.map((entry) => ({
        extensionId: entry.extensionId,
        displayName: entry.displayName,
        description: entry.description,
        publisher: entry.publisher,
        iconUrl: entry.iconUrl,
      })),
    [installedEntries],
  );

  const popularItems = useMemo<SidebarItem[]>(
    () =>
      results.slice(0, 8).map((result) => ({
        extensionId: result.id,
        displayName: result.displayName,
        description: result.description,
        publisher: result.namespace,
        iconUrl: result.iconUrl,
        verified: result.verified,
      })),
    [results],
  );

  const recommendedItems = useMemo<SidebarItem[]>(
    () =>
      results.slice(8, 14).map((result) => ({
        extensionId: result.id,
        displayName: result.displayName,
        description: result.description,
        publisher: result.namespace,
        iconUrl: result.iconUrl,
        verified: result.verified,
      })),
    [results],
  );

  async function runSearch(nextQuery: string) {
    setSearching(true);
    try {
      const data = await searchExtensions(nextQuery);
      setResults(data);
      if (!selectedExtensionId && data[0]) {
        setSelectedExtensionId(data[0].id);
      }
    } catch {
      toast.error('Falha ao buscar extensões');
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    void runSearch('theme');
  }, []);

  async function handleSearch() {
    const nextQuery = query.trim() || 'theme';
    await runSearch(nextQuery);
  }

  async function handleSelect(extensionId: string) {
    setSelectedExtensionId(extensionId);
    try {
      const detail = await getExtensionDetail(extensionId);
      openTab({
        path: `Extensions/${detail.extension.displayName}`,
        name: `Extension: ${detail.extension.displayName}`,
        content: detail.readme ?? '',
        originalContent: detail.readme ?? '',
        encoding: 'utf-8',
        mimeType: 'application/x-web-ide-extension',
        dirty: false,
        kind: 'extension',
        iconUrl: detail.extension.iconUrl,
        extensionDetail: detail,
      });
    } catch {
      toast.error('Falha ao carregar detalhe da extensão');
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b px-4 py-3">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>Extensions</span>
          <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => void handleSearch()} title="Recarregar">
            <RefreshCcw className={cn('h-3.5 w-3.5', searching && 'animate-spin')} />
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Extensions in Marketplace"
              className="h-9 border-border/80 bg-muted/20 pl-9 text-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSearch();
              }}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 shrink-0"
            onClick={() => void handleSearch()}
            aria-label="Buscar extensões"
            title="Buscar extensões"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <SidebarSection
          title="Installed"
          count={installedItems.length}
          items={installedItems}
          selectedId={selectedExtensionId}
          onSelect={handleSelect}
        />
        <SidebarSection
          title="Popular"
          items={popularItems}
          selectedId={selectedExtensionId}
          onSelect={handleSelect}
        />
        <SidebarSection
          title="Recommended"
          count={recommendedItems.length > 0 ? recommendedItems.length : undefined}
          items={recommendedItems}
          selectedId={selectedExtensionId}
          onSelect={handleSelect}
        />
      </ScrollArea>
    </div>
  );
}
