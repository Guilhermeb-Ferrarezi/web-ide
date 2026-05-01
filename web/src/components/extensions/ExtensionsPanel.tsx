import { useState } from 'react';
import { toast } from 'sonner';
import { installExtension, searchExtensions } from '@/api/extensions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAppearanceStore } from '@/stores/appearanceStore';

export function ExtensionsPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchExtensions>>>([]);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const installedThemes = useAppearanceStore((state) => state.installedThemes);
  const installTheme = useAppearanceStore((state) => state.installTheme);
  const installIconThemeStore = useAppearanceStore((state) => state.installIconTheme);
  const setActiveTheme = useAppearanceStore((state) => state.setActiveTheme);
  const setActiveIconTheme = useAppearanceStore((state) => state.setActiveIconTheme);

  async function handleSearch() {
    const nextQuery = query.trim();
    if (!nextQuery) {
      setResults([]);
      return;
    }

    setSearching(true);
    try {
      setResults(await searchExtensions(nextQuery));
    } catch {
      toast.error('Falha ao buscar extensões');
    } finally {
      setSearching(false);
    }
  }

  async function handleInstall(extensionId: string) {
    setInstallingId(extensionId);
    try {
      const payload = await installExtension(extensionId);
      for (const theme of payload.themes) installTheme(theme);
      for (const iconTheme of payload.iconThemes) installIconThemeStore(iconTheme);
      if (payload.themes[0]) setActiveTheme(payload.themes[0].id);
      if (payload.iconThemes[0]) setActiveIconTheme(payload.iconThemes[0].id);
      toast.success('Extensão instalada');
    } catch {
      toast.error('Falha ao instalar extensão');
    } finally {
      setInstallingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extensões</CardTitle>
        <CardDescription>Busque temas e icon themes do marketplace.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar temas e icon themes..."
          />
          <Button type="button" onClick={() => void handleSearch()} disabled={searching}>
            Buscar
          </Button>
        </div>

        <div className="space-y-3">
          {results.map((result) => {
            const installedTheme = installedThemes.find((theme) => theme.extensionId === result.id);
            return (
              <div key={result.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{result.displayName}</p>
                  {result.description ? (
                    <p className="text-sm text-muted-foreground">{result.description}</p>
                  ) : null}
                </div>
                {installedTheme ? (
                  <Button type="button" variant="secondary" onClick={() => setActiveTheme(installedTheme.id)}>
                    {`Aplicar ${installedTheme.label}`}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void handleInstall(result.id)}
                    disabled={installingId === result.id}
                  >
                    Instalar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
