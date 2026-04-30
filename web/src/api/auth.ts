import { api } from './client';
import type { AuthUser } from '@/types';

export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export function getGithubLoginUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  return `${base}/auth/github`;
}
