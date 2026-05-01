import { create } from 'zustand';
import type { EditorTab } from '@/types';

export type EditorJump = { line: number; column: number };

type EditorState = {
  tabs: EditorTab[];
  activePath: string | null;
  pendingJump: EditorJump | null;
  openTab: (tab: EditorTab) => void;
  closeTab: (path: string) => void;
  setActive: (path: string) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  setPendingJump: (jump: EditorJump | null) => void;
  reset: () => void;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activePath: null,
  pendingJump: null,
  openTab: (tab) => {
    const exists = get().tabs.find((t) => t.path === tab.path);
    if (exists) return set({ activePath: tab.path });
    set((s) => ({ tabs: [...s.tabs, tab], activePath: tab.path }));
  },
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
  reset: () => set({ tabs: [], activePath: null, pendingJump: null }),
}));
