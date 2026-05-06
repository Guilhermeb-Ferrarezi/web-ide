import type { InstalledTheme } from '@/types';

export function buildMonacoThemeData(theme: InstalledTheme) {
  return {
    base: theme.uiTheme,
    inherit: true,
    rules: [...theme.rules, ...(theme.semanticRules ?? [])],
    colors: theme.colors,
  };
}

export function getMonacoThemeName(theme: InstalledTheme): string {
  const normalized = theme.id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `ext-${normalized || 'theme'}`;
}
