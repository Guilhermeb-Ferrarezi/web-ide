import { create } from 'zustand';
import type { EditorTab } from '@/types';

export type EditorJump = { line: number; column: number };
export type AutoSaveMode = 'off' | 'afterDelay';

const EDITOR_PREFERENCES_STORAGE_KEY = 'web-ide.editor-preferences';

function readStoredPreferences(): {
  wordWrap: boolean;
  autoSaveMode: AutoSaveMode;
  autoSaveDelayMs: number;
  fontSize: number;
} {
  if (typeof window === 'undefined') {
    return { wordWrap: true, autoSaveMode: 'off', autoSaveDelayMs: 1200, fontSize: 13 };
  }

  try {
    const raw = window.localStorage.getItem(EDITOR_PREFERENCES_STORAGE_KEY);
    if (!raw) return { wordWrap: true, autoSaveMode: 'off', autoSaveDelayMs: 1200, fontSize: 13 };
    const parsed = JSON.parse(raw) as Partial<{
      wordWrap: boolean;
      autoSaveMode: AutoSaveMode;
      autoSaveDelayMs: number;
      fontSize: number;
    }>;

    return {
      wordWrap: parsed.wordWrap ?? true,
      autoSaveMode: parsed.autoSaveMode === 'afterDelay' ? 'afterDelay' : 'off',
      autoSaveDelayMs:
        parsed.autoSaveDelayMs === 3000 || parsed.autoSaveDelayMs === 1200 ? parsed.autoSaveDelayMs : 1200,
      fontSize: typeof parsed.fontSize === 'number' && parsed.fontSize >= 10 && parsed.fontSize <= 24 ? parsed.fontSize : 13,
    };
  } catch {
    return { wordWrap: true, autoSaveMode: 'off', autoSaveDelayMs: 1200, fontSize: 13 };
  }
}

function persistPreferences(input: {
  wordWrap: boolean;
  autoSaveMode: AutoSaveMode;
  autoSaveDelayMs: number;
  fontSize: number;
}) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EDITOR_PREFERENCES_STORAGE_KEY, JSON.stringify(input));
}

const storedPreferences = readStoredPreferences();

type EditorState = {
  tabs: EditorTab[];
  activePath: string | null;
  pendingJump: EditorJump | null;
  cursorPosition: { line: number; column: number } | null;
  wordWrap: boolean;
  autoSaveMode: AutoSaveMode;
  autoSaveDelayMs: number;
  fontSize: number;
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
  wordWrap: storedPreferences.wordWrap,
  autoSaveMode: storedPreferences.autoSaveMode,
  autoSaveDelayMs: storedPreferences.autoSaveDelayMs,
  fontSize: storedPreferences.fontSize,
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
