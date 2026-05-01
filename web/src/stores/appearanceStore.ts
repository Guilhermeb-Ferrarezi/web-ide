import { create } from 'zustand';
import type { InstalledExtensionsStatePayload, InstalledIconTheme, InstalledTheme } from '@/types';
import { useWorkspaceStore } from './workspaceStore';

export const DEFAULT_EDITOR_THEME_ID = 'default-dark';
export const DEFAULT_ICON_THEME_ID = 'material-default';
const APPEARANCE_STORAGE_KEY_PREFIX = 'web-ide:appearance:';

type AppearanceState = {
  installedThemes: InstalledTheme[];
  installedIconThemes: InstalledIconTheme[];
  activeThemeId: string;
  activeIconThemeId: string;
  installTheme: (theme: InstalledTheme) => void;
  installIconTheme: (iconTheme: InstalledIconTheme) => void;
  replaceInstalled: (payload: InstalledExtensionsStatePayload, workspace?: string | null) => void;
  resetInstalled: () => void;
  setActiveTheme: (themeId: string, workspace?: string | null) => void;
  setActiveIconTheme: (iconThemeId: string, workspace?: string | null) => void;
};

function upsertById<T extends { id: string }>(items: T[], nextItem: T): T[] {
  const index = items.findIndex((item) => item.id === nextItem.id);
  if (index === -1) return [...items, nextItem];
  const nextItems = items.slice();
  nextItems[index] = nextItem;
  return nextItems;
}

type PersistedAppearance = {
  activeThemeId?: string;
  activeIconThemeId?: string;
};

function getWorkspaceKey(workspace?: string | null): string | null {
  const resolved = workspace ?? useWorkspaceStore.getState().workspace;
  return resolved ? `${APPEARANCE_STORAGE_KEY_PREFIX}${resolved}` : null;
}

function readPersistedAppearance(workspace?: string | null): PersistedAppearance | null {
  const key = getWorkspaceKey(workspace);
  if (!key) return null;

  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedAppearance;
  } catch {
    return null;
  }
}

function writePersistedAppearance(
  appearance: { activeThemeId: string; activeIconThemeId: string },
  workspace?: string | null,
) {
  const key = getWorkspaceKey(workspace);
  if (!key) return;

  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(appearance));
  } catch {
    // ignore persistence failures
  }
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
  replaceInstalled: (payload, workspace) =>
    set((state) => {
      const persisted = readPersistedAppearance(workspace);
      const activeThemeId = resolveActiveId(
        payload.themes,
        persisted?.activeThemeId ?? state.activeThemeId,
        DEFAULT_EDITOR_THEME_ID,
      );
      const activeIconThemeId = resolveActiveId(
        payload.iconThemes,
        persisted?.activeIconThemeId ?? state.activeIconThemeId,
        DEFAULT_ICON_THEME_ID,
      );

      writePersistedAppearance({ activeThemeId, activeIconThemeId }, workspace);

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
  setActiveTheme: (themeId, workspace) =>
    set((state) => {
      const activeThemeId = resolveActiveId(state.installedThemes, themeId, DEFAULT_EDITOR_THEME_ID);
      writePersistedAppearance({ activeThemeId, activeIconThemeId: state.activeIconThemeId }, workspace);
      return { activeThemeId };
    }),
  setActiveIconTheme: (iconThemeId, workspace) =>
    set((state) => {
      const activeIconThemeId = resolveActiveId(state.installedIconThemes, iconThemeId, DEFAULT_ICON_THEME_ID);
      writePersistedAppearance({ activeThemeId: state.activeThemeId, activeIconThemeId }, workspace);
      return { activeIconThemeId };
    }),
}));
