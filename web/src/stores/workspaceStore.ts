import { create } from 'zustand';

type WorkspaceState = {
  workspace: string | null;
  permission: 'read' | 'write' | null;
  setWorkspace: (name: string | null) => void;
  setPermission: (permission: 'read' | 'write' | null) => void;
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspace: null,
  permission: null,
  setWorkspace: (workspace) => set({ workspace }),
  setPermission: (permission) => set({ permission }),
}));
