import { create } from 'zustand';
import type { AppearanceSettings, InstalledExtensionsStatePayload, InstalledIconTheme, InstalledTheme } from '@/types';
import { queueUserSettingPersist } from '@/lib/userSettingsPersistence';
import { saveAppearanceSettings } from '@/api/settings';

export const DEFAULT_EDITOR_THEME_ID = 'default-dark';
export const DEFAULT_ICON_THEME_ID = 'material-default';

type AppearanceState = {
  installedThemes: InstalledTheme[];
  installedIconThemes: InstalledIconTheme[];
  activeThemeId: string;
  activeIconThemeId: string;
  installTheme: (theme: InstalledTheme) => void;
  installIconTheme: (iconTheme: InstalledIconTheme) => void;
  hydratePreferences: (settings?: AppearanceSettings) => void;
  replaceInstalled: (payload: InstalledExtensionsStatePayload) => void;
  resetInstalled: () => void;
  setActiveTheme: (themeId: string, workspace?: string | null) => void;
  setActiveIconTheme: (iconThemeId: string, workspace?: string | null) => void;
  uninstallExtension: (extensionId: string, workspace?: string | null) => void;
};

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  const nextItems = items.slice();
  nextItems[index] = nextItem;
  return nextItems;
}

function persistAppearance(appearance: AppearanceSettings) {
  queueUserSettingPersist('appearance', appearance, saveAppearanceSettings);
}

function resolveActiveId<T extends { id: string }>(
  items: T[],
  preferredId: string | undefined,
  fallbackId: string,
): string {
  if (preferredId === fallbackId) return fallbackId;
  return preferredId && items.some((item) => item.id === preferredId) ? preferredId : fallbackId;
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
  hydratePreferences: (settings) =>
    set({
      activeThemeId: settings?.activeThemeId ?? DEFAULT_EDITOR_THEME_ID,
      activeIconThemeId: settings?.activeIconThemeId ?? DEFAULT_ICON_THEME_ID,
    }),
  replaceInstalled: (payload) =>
    set((state) => {
      const activeThemeId = resolveActiveId(
        payload.themes,
        state.activeThemeId,
        DEFAULT_EDITOR_THEME_ID,
      );
      const activeIconThemeId = resolveActiveId(
        payload.iconThemes,
        state.activeIconThemeId,
        DEFAULT_ICON_THEME_ID,
      );

      return {
        installedThemes: payload.themes,
        installedIconThemes: payload.iconThemes,
        activeThemeId,
        activeIconThemeId,
      };
    }),
  resetInstalled: () =>
    set({
      installedThemes: [],
      installedIconThemes: [],
      activeThemeId: DEFAULT_EDITOR_THEME_ID,
      activeIconThemeId: DEFAULT_ICON_THEME_ID,
    }),
  setActiveTheme: (themeId) =>
    set((state) => {
      const activeThemeId = resolveActiveId(state.installedThemes, themeId, DEFAULT_EDITOR_THEME_ID);
      persistAppearance({ activeThemeId, activeIconThemeId: state.activeIconThemeId });
      return { activeThemeId };
    }),
  setActiveIconTheme: (iconThemeId) =>
    set((state) => {
      const activeIconThemeId = resolveActiveId(state.installedIconThemes, iconThemeId, DEFAULT_ICON_THEME_ID);
      persistAppearance({ activeThemeId: state.activeThemeId, activeIconThemeId });
      return { activeIconThemeId };
    }),
  uninstallExtension: (extensionId) =>
    set((state) => {
      const installedThemes = state.installedThemes.filter((theme) => theme.extensionId !== extensionId);
      const installedIconThemes = state.installedIconThemes.filter((theme) => theme.extensionId !== extensionId);
      const activeThemeId = resolveActiveId(installedThemes, state.activeThemeId, DEFAULT_EDITOR_THEME_ID);
      const activeIconThemeId = resolveActiveId(installedIconThemes, state.activeIconThemeId, DEFAULT_ICON_THEME_ID);
      persistAppearance({ activeThemeId, activeIconThemeId });

      return {
        installedThemes,
        installedIconThemes,
        activeThemeId,
        activeIconThemeId,
      };
    }),
}));
