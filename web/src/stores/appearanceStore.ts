import { create } from 'zustand';
import type { InstalledIconTheme, InstalledTheme } from '@/types';

export const DEFAULT_EDITOR_THEME_ID = 'default-dark';
export const DEFAULT_ICON_THEME_ID = 'material-default';

type AppearanceState = {
  installedThemes: InstalledTheme[];
  installedIconThemes: InstalledIconTheme[];
  activeThemeId: string;
  activeIconThemeId: string;
  installTheme: (theme: InstalledTheme) => void;
  installIconTheme: (iconTheme: InstalledIconTheme) => void;
  setActiveTheme: (themeId: string) => void;
  setActiveIconTheme: (iconThemeId: string) => void;
};

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  const nextItems = items.slice();
  nextItems[index] = nextItem;
  return nextItems;
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  installedThemes: [],
  installedIconThemes: [],
  activeThemeId: DEFAULT_EDITOR_THEME_ID,
  activeIconThemeId: DEFAULT_ICON_THEME_ID,
  installTheme: (theme) =>
    set((state) => ({
      installedThemes: upsertById(state.installedThemes, theme),
    })),
  installIconTheme: (iconTheme) =>
    set((state) => ({
      installedIconThemes: upsertById(state.installedIconThemes, iconTheme),
    })),
  setActiveTheme: (themeId) => set({ activeThemeId: themeId }),
  setActiveIconTheme: (iconThemeId) => set({ activeIconThemeId: iconThemeId }),
}));
