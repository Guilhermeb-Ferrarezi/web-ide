import { create } from 'zustand';
import type { AutoSaveMode, EditorSettings, EditorTab } from '@/types';
import { queueUserSettingPersist } from '@/lib/userSettingsPersistence';
import { saveEditorSettings } from '@/api/settings';

export type EditorJump = { line: number; column: number };

const defaultPreferences: EditorSettings = {
  wordWrap: true,
  autoSaveMode: 'off',
  autoSaveDelayMs: 1200,
  fontSize: 13,
};

function persistPreferences(input: EditorSettings) {
  queueUserSettingPersist('editor', input, saveEditorSettings);
}

function normalizePreferences(input?: Partial<EditorSettings>): EditorSettings {
  return {
    wordWrap: input?.wordWrap ?? defaultPreferences.wordWrap,
    autoSaveMode: input?.autoSaveMode === 'afterDelay' ? 'afterDelay' : 'off',
    autoSaveDelayMs:
      input?.autoSaveDelayMs === 3000 || input?.autoSaveDelayMs === 1200
        ? input.autoSaveDelayMs
        : defaultPreferences.autoSaveDelayMs,
    fontSize:
      typeof input?.fontSize === 'number' && input.fontSize >= 10 && input.fontSize <= 24
        ? input.fontSize
        : defaultPreferences.fontSize,
  };
}

type EditorState = {
  tabs: EditorTab[];
  activePath: string | null;
  pendingJump: EditorJump | null;
  cursorPosition: { line: number; column: number } | null;
  wordWrap: boolean;
  autoSaveMode: AutoSaveMode;
  autoSaveDelayMs: number;
  fontSize: number;
  hydratePreferences: (input?: Partial<EditorSettings>) => void;
  openTab: (tab: EditorTab) => void;
  upsertTab: (tab: EditorTab) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  setPendingJump: (jump: EditorJump | null) => void;
  setCursorPosition: (pos: { line: number; column: number } | null) => void;
  toggleWordWrap: () => void;
  setAutoSaveMode: (mode: AutoSaveMode) => void;
  setAutoSaveDelayMs: (delayMs: number) => void;
  setFontSize: (size: number) => void;
  reset: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activePath: null,
  pendingJump: null,
  cursorPosition: null,
  wordWrap: defaultPreferences.wordWrap,
  autoSaveMode: defaultPreferences.autoSaveMode,
  autoSaveDelayMs: defaultPreferences.autoSaveDelayMs,
  fontSize: defaultPreferences.fontSize,
  hydratePreferences: (input) => set(normalizePreferences(input)),
  openTab: (tab) => {
    const exists = get().tabs.find((t) => t.path === tab.path);
    if (exists) return set({ activePath: tab.path });
    set((s) => ({ tabs: [...s.tabs, tab], activePath: tab.path }));
  },
  upsertTab: (tab) =>
    set((s) => {
      const index = s.tabs.findIndex((existing) => existing.path === tab.path);
      if (index === -1) {
        return { tabs: [...s.tabs, tab], activePath: tab.path };
      }
      const tabs = s.tabs.slice();
      tabs[index] = tab;
      return { tabs, activePath: tab.path };
    }),
  closeTab: (path) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.path !== path);
      const activePath =
        s.activePath === path ? (tabs[tabs.length - 1]?.path ?? null) : s.activePath;
      return { tabs, activePath };
    }),
  setActive: (path) => set({ activePath: path }),
  updateContent: (path, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, content, dirty: content !== t.originalContent } : t,
      ),
    })),
  markSaved: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.path === path ? { ...t, originalContent: t.content, dirty: false } : t,
      ),
    })),
  setPendingJump: (jump) => set({ pendingJump: jump }),
  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  toggleWordWrap: () =>
    set((s) => {
      const wordWrap = !s.wordWrap;
      persistPreferences({ wordWrap, autoSaveMode: s.autoSaveMode, autoSaveDelayMs: s.autoSaveDelayMs, fontSize: s.fontSize });
      return { wordWrap };
    }),
  setAutoSaveMode: (autoSaveMode) =>
    set((s) => {
      persistPreferences({ wordWrap: s.wordWrap, autoSaveMode, autoSaveDelayMs: s.autoSaveDelayMs, fontSize: s.fontSize });
      return { autoSaveMode };
    }),
  setAutoSaveDelayMs: (autoSaveDelayMs) =>
    set((s) => {
      persistPreferences({ wordWrap: s.wordWrap, autoSaveMode: s.autoSaveMode, autoSaveDelayMs, fontSize: s.fontSize });
      return { autoSaveDelayMs };
    }),
  setFontSize: (fontSize) =>
    set((s) => {
      const clamped = Math.min(24, Math.max(10, fontSize));
      persistPreferences({ wordWrap: s.wordWrap, autoSaveMode: s.autoSaveMode, autoSaveDelayMs: s.autoSaveDelayMs, fontSize: clamped });
      return { fontSize: clamped };
    }),
  reset: () => set({ tabs: [], activePath: null, pendingJump: null, cursorPosition: null }),
}));
