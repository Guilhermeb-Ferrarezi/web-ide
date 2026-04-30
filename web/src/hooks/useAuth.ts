import { create } from 'zustand';
import { useEffect } from 'react';
import { getMe, logout as apiLogout } from '@/api/auth';
import type { AuthUser } from '@/types';

type AuthState = {
  user: AuthUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  async fetchMe() {
    set({ status: 'loading' });
    try {
      const user = await getMe();
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'unauthenticated' });
    }
  },
  async logout() {
    await apiLogout();
    set({ user: null, status: 'unauthenticated' });
  },
}));

export function useAuth() {
  const state = useAuthStore();
  useEffect(() => {
    if (state.status === 'idle') void state.fetchMe();
  }, [state]);
  return state;
}
