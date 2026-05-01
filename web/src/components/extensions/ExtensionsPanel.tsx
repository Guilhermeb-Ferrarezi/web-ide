import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  ExternalLink,
  RefreshCcw,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { getExtensionDetail, installExtension, searchExtensions } from '@/api/extensions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAppearanceStore } from '@/stores/appearanceStore';
import type { ExtensionDetail, MarketplaceExtension } from '@/types';

function formatDownloads(count: number) {
  return new Intl.NumberFormat('en-US').format(count);
}

function formatRelativeDate(date: string | null) {
  if (!date) return 'Unknown';
  const diffMs = Date.now() - new Date(date).getTime();
  const days = Math.max(1, Math.floor(diffMs / 86_400_000));
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return `${years} years ago`;
}

type InstalledEntry = {
  extensionId: string;
  displayName: string;
  publisher: string;
  kind: 'theme' | 'icon-theme';
  applyLabel: string;
  onApply: () => void;
  active: boolean;
};

type SidebarItem = {
  extensionId: string;
  displayName: string;
  description: string | null;
  publisher: string;
  iconUrl: string | null;
  downloadCount?: number;
  averageRating?: number;
  verified?: boolean;
  installed: boolean;
  active: boolean;
  installable: boolean;
};

function MarkdownBlock({
  content,
  title,
}: {
  content: string | null;
  title?: string;
}) {
  if (!content) {
    return <p className="text-sm text-muted-foreground">No details available for this extension.</p>;
  }

  const lines = content.split('\n');
  const blocks: Array<{ type: 'h1' | 'h2' | 'li' | 'p'; text: string }> = [];
  const normalizedTitle = title?.trim().toLowerCase();

  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    if (text.startsWith('### ')) {
      blocks.push({ type: 'h2', text: text.slice(4) });
      continue;
    }
    if (text.startsWith('## ')) {
      blocks.push({ type: 'h2', text: text.slice(3) });
      continue;
    }
    if (text.startsWith('# ')) {
      const headingText = text.slice(2);
      if (headingText.trim().toLowerCase() === normalizedTitle) {
        continue;
      }
      blocks.push({ type: 'h1', text: headingText });
      continue;
    }
    if (text.startsWith('- ') || text.startsWith('* ')) {
      blocks.push({ type: 'li', text: text.slice(2) });
      continue;
    }
    blocks.push({ type: 'p', text });
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === 'h1') {
          return <h2 key={index} className="text-4xl font-semibold tracking-tight">{block.text}</h2>;
        }
        if (block.type === 'h2') {
          return <h3 key={index} className="border-b pb-3 text-2xl font-semibold tracking-tight">{block.text}</h3>;
        }
        if (block.type === 'li') {
          return (
            <li key={index} className="ml-5 list-disc text-base leading-7 text-foreground/90">
              {block.text}
            </li>
          );
        }
        return <p key={index} className="text-base leading-7 text-foreground/90">{block.text}</p>;
      })}
    </div>
  );
}

function SidebarSection({
  title,
  count,
  items,
  selectedId,
  installingId,
  onSelect,
  onInstall,
}: {
  title: string;
  count?: number;
  items: SidebarItem[];
  selectedId: string | null;
  installingId: string | null;
  onSelect: (extensionId: string) => void;
  onInstall: (extensionId: string) => void;
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
              {item.installed ? <CheckCheck className="h-4 w-4 text-emerald-400" /> : <span className="text-lg">◫</span>}
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

          {item.installable ? (
            <Button
              type="button"
              size="sm"
              className="mt-1 h-7 shrink-0 bg-emerald-400 px-3 text-emerald-950 hover:bg-emerald-300"
              onClick={(event) => {
                event.stopPropagation();
                onInstall(item.extensionId);
              }}
              disabled={installingId === item.extensionId}
            >
              {installingId === item.extensionId ? '...' : 'Instalar'}
            </Button>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export function ExtensionsPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MarketplaceExtension[]>([]);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ExtensionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const installedThemes = useAppearanceStore((state) => state.installedThemes);
  const installedIconThemes = useAppearanceStore((state) => state.installedIconThemes);
  const activeThemeId = useAppearanceStore((state) => state.activeThemeId);
  const activeIconThemeId = useAppearanceStore((state) => state.activeIconThemeId);
  const installThemeStore = useAppearanceStore((state) => state.installTheme);
  const installIconThemeStore = useAppearanceStore((state) => state.installIconTheme);
  const setActiveTheme = useAppearanceStore((state) => state.setActiveTheme);
  const setActiveIconTheme = useAppearanceStore((state) => state.setActiveIconTheme);

  const installedEntries = useMemo<InstalledEntry[]>(() => {
    const themes = installedThemes.map((theme) => ({
      extensionId: theme.extensionId,
      displayName: theme.label,
      publisher: theme.extensionId.split('.')[0] ?? '',
      kind: 'theme' as const,
      applyLabel: `Set Color Theme`,
      onApply: () => setActiveTheme(theme.id),
      active: activeThemeId === theme.id,
    }));
    const iconThemes = installedIconThemes.map((theme) => ({
      extensionId: theme.extensionId,
      displayName: theme.label,
      publisher: theme.extensionId.split('.')[0] ?? '',
      kind: 'icon-theme' as const,
      applyLabel: `Set File Icon Theme`,
      onApply: () => setActiveIconTheme(theme.id),
      active: activeIconThemeId === theme.id,
    }));
    return [...themes, ...iconThemes];
  }, [activeIconThemeId, activeThemeId, installedIconThemes, installedThemes, setActiveIconTheme, setActiveTheme]);

  const installedIds = useMemo(() => new Set(installedEntries.map((entry) => entry.extensionId)), [installedEntries]);

  const installedSidebarItems = useMemo<SidebarItem[]>(
    () =>
      installedEntries.map((entry) => ({
        extensionId: entry.extensionId,
        displayName: entry.displayName,
        description: entry.kind === 'theme' ? 'Installed color theme' : 'Installed file icon theme',
        publisher: entry.publisher,
        iconUrl: null,
        installed: true,
        active: entry.active,
        installable: false,
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
        downloadCount: result.downloadCount,
        averageRating: result.averageRating,
        verified: result.verified,
        installed: installedIds.has(result.id),
        active: false,
        installable: !installedIds.has(result.id),
      })),
    [installedIds, results],
  );

  const recommendedItems = useMemo<SidebarItem[]>(
    () =>
      results.slice(8, 14).map((result) => ({
        extensionId: result.id,
        displayName: result.displayName,
        description: result.description,
        publisher: result.namespace,
        iconUrl: result.iconUrl,
        downloadCount: result.downloadCount,
        averageRating: result.averageRating,
        verified: result.verified,
        installed: installedIds.has(result.id),
        active: false,
        installable: !installedIds.has(result.id),
      })),
    [installedIds, results],
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

  useEffect(() => {
    if (!selectedExtensionId) return;
    let cancelled = false;
    setDetailLoading(true);
    void (async () => {
      try {
        const detail = await getExtensionDetail(selectedExtensionId);
        if (!cancelled) setSelectedDetail(detail);
      } catch {
        if (!cancelled) toast.error('Falha ao carregar detalhe da extensão');
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExtensionId]);

  async function handleSearch() {
    const nextQuery = query.trim() || 'theme';
    await runSearch(nextQuery);
  }

  async function handleInstall(extensionId: string) {
    setInstallingId(extensionId);
    try {
      const payload = await installExtension(extensionId);
      for (const theme of payload.themes) installThemeStore(theme);
      for (const iconTheme of payload.iconThemes) installIconThemeStore(iconTheme);
      if (payload.themes[0]) setActiveTheme(payload.themes[0].id);
      if (payload.iconThemes[0]) setActiveIconTheme(payload.iconThemes[0].id);
      setSelectedExtensionId(extensionId);
      toast.success(`${payload.displayName} instalada`);
    } catch {
      toast.error('Falha ao instalar extensão');
    } finally {
      setInstallingId(null);
    }
  }

  const activeInstalledEntry = installedEntries.find((entry) => entry.extensionId === selectedExtensionId) ?? null;
  const canInstallSelected = selectedDetail ? !installedIds.has(selectedDetail.extension.id) : false;

  return (
    <div className="flex h-full bg-background">
      <div className="flex w-[300px] shrink-0 flex-col border-r">
        <div className="border-b px-4 py-3">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Extensions</span>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => void handleSearch()} title="Recarregar">
                <RefreshCcw className={cn('h-3.5 w-3.5', searching && 'animate-spin')} />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Extensions in Marketplace"
              className="h-9 border-border/80 bg-muted/20 pl-9 pr-12 text-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSearch();
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2 text-xs"
              onClick={() => void handleSearch()}
            >
              Buscar extensões
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <SidebarSection
            title="Installed"
            count={installedSidebarItems.length}
            items={installedSidebarItems}
            selectedId={selectedExtensionId}
            installingId={installingId}
            onSelect={setSelectedExtensionId}
            onInstall={handleInstall}
          />
          <SidebarSection
            title="Popular"
            items={popularItems}
            selectedId={selectedExtensionId}
            installingId={installingId}
            onSelect={setSelectedExtensionId}
            onInstall={handleInstall}
          />
          <SidebarSection
            title="Recommended"
            count={recommendedItems.length > 0 ? recommendedItems.length : undefined}
            items={recommendedItems}
            selectedId={selectedExtensionId}
            installingId={installingId}
            onSelect={setSelectedExtensionId}
            onInstall={handleInstall}
          />
        </ScrollArea>
      </div>

      <div className="min-w-0 flex-1">
        {detailLoading || !selectedDetail ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Carregando detalhe da extensão...
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="border-b px-10 py-8">
              <div className="flex items-start gap-8">
                {selectedDetail.extension.iconUrl ? (
                  <img
                    src={selectedDetail.extension.iconUrl}
                    alt={selectedDetail.extension.displayName}
                    className="h-28 w-28 rounded-2xl border object-cover"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-2xl border bg-muted/30 text-5xl text-muted-foreground">
                    ◫
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h1 className="text-5xl font-semibold tracking-tight">{selectedDetail.extension.displayName}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-lg text-muted-foreground">
                    <span>{selectedDetail.extension.namespace}</span>
                    {selectedDetail.extension.verified ? <ShieldCheck className="h-4 w-4 text-sky-400" /> : null}
                    <span className="text-sky-400">{selectedDetail.extension.namespace.toLowerCase()}.com</span>
                    <span>|</span>
                    <span>{formatDownloads(selectedDetail.extension.downloadCount)}</span>
                    {typeof selectedDetail.extension.averageRating === 'number' ? (
                      <>
                        <span>|</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          {selectedDetail.extension.averageRating}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-4 max-w-3xl text-2xl text-foreground/90">
                    {selectedDetail.extension.description ?? 'No description provided.'}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    {activeInstalledEntry ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={activeInstalledEntry.onApply}
                        disabled={activeInstalledEntry.active}
                      >
                        {activeInstalledEntry.active ? 'Ativa' : activeInstalledEntry.applyLabel}
                      </Button>
                    ) : null}
                    {canInstallSelected ? (
                      <Button
                        type="button"
                        className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                        onClick={() => void handleInstall(selectedDetail.extension.id)}
                        disabled={installingId === selectedDetail.extension.id}
                      >
                        {installingId === selectedDetail.extension.id ? 'Instalando...' : 'Instalar extensão'}
                      </Button>
                    ) : null}
                    {!canInstallSelected ? (
                      <Button type="button" variant="outline" disabled>
                        Uninstall
                      </Button>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-input bg-background" />
                      Auto Update
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-6 border-b border-border/60 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <button type="button" className="border-b-2 border-emerald-300 pb-3 text-foreground">Details</button>
                <button type="button" className="pb-3">Features</button>
                <button type="button" className="pb-3">Changelog</button>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="grid min-h-full grid-cols-[minmax(0,1fr)_320px] gap-12 px-10 py-8">
                <div className="min-w-0 space-y-6">
                  <MarkdownBlock content={selectedDetail.readme} title={selectedDetail.extension.displayName} />
                </div>

                <aside className="border-l border-border/60 pl-8">
                  <div className="space-y-8">
                    <section>
                      <h2 className="mb-4 text-3xl font-semibold tracking-tight">Marketplace</h2>
                      <dl className="space-y-3 text-sm">
                        <div className="flex justify-between gap-4 border-b border-border/40 py-1">
                          <dt className="text-muted-foreground">Identifier</dt>
                          <dd className="text-right">{selectedDetail.extension.namespace.toLowerCase()}.{selectedDetail.extension.name}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-border/40 py-1">
                          <dt className="text-muted-foreground">Version</dt>
                          <dd>{selectedDetail.extension.version}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-border/40 py-1">
                          <dt className="text-muted-foreground">Published</dt>
                          <dd>{formatRelativeDate(selectedDetail.publishedAt)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 border-b border-border/40 py-1">
                          <dt className="text-muted-foreground">Last Released</dt>
                          <dd>{formatRelativeDate(selectedDetail.updatedAt)}</dd>
                        </div>
                      </dl>
                    </section>

                    <section>
                      <h2 className="mb-4 text-3xl font-semibold tracking-tight">Categories</h2>
                      <div className="flex flex-wrap gap-2">
                        {selectedDetail.categories.length > 0 ? selectedDetail.categories.map((category) => (
                          <span key={category} className="rounded border px-2 py-1 text-xs">
                            {category}
                          </span>
                        )) : <span className="text-sm text-muted-foreground">None</span>}
                      </div>
                    </section>

                    <section>
                      <h2 className="mb-4 text-3xl font-semibold tracking-tight">Resources</h2>
                      <div className="space-y-2">
                        {selectedDetail.resources.map((resource) => (
                          <a
                            key={`${resource.label}-${resource.url}`}
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-sm text-foreground hover:text-sky-400"
                          >
                            <ExternalLink className="h-4 w-4" />
                            {resource.label}
                          </a>
                        ))}
                      </div>
                    </section>
                  </div>
                </aside>
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
