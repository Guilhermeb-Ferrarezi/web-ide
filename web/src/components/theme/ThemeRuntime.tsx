import { useEffect } from 'react';
import { Toaster } from 'sonner';
import { DEFAULT_EDITOR_THEME_ID, useAppearanceStore } from '@/stores/appearanceStore';
import { applyShellTheme, getShellThemeMode } from '@/lib/ideTheme';

export function ThemeRuntime() {
  const activeThemeId = useAppearanceStore((state) => state.activeThemeId);
  const installedThemes = useAppearanceStore((state) => state.installedThemes);
  const activeTheme = activeThemeId === DEFAULT_EDITOR_THEME_ID
    ? null
    : installedThemes.find((theme) => theme.id === activeThemeId) ?? null;
  const mode = getShellThemeMode(activeTheme);

  useEffect(() => {
    applyShellTheme(null);
  }, []);

  return <Toaster richColors position="top-right" theme={mode} />;
}
