import { api } from './client';
import type { LocalRepo, RemoteRepo } from '@/types';

export async function listRemoteRepos(): Promise<RemoteRepo[]> {
  const { data } = await api.get<RemoteRepo[]>('/repos');
  return data;
}

export async function listLocalRepos(): Promise<LocalRepo[]> {
  const { data } = await api.get<LocalRepo[]>('/repos/local');
  return data;
}

export async function cloneRepo(repoFullName: string, branch?: string) {
  const { data } = await api.post<{ name: string; path: string }>('/repos/clone', { repoFullName, branch });
  return data;
}

export async function deleteLocalRepo(name: string) {
  await api.delete(`/repos/local/${encodeURIComponent(name)}`);
}
