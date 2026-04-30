import { create } from 'zustand';

type WorkspaceState = {
  workspace: string | null;
  setWorkspace: (name: string | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  setWorkspace: (workspace) => set({ workspace }),
}));
