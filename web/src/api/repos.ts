import { api } from './client';
import type { LocalRepo, RepoPermissionEntry, ReposPayload, ShareUserCandidate } from '@/types';

export type ListReposParams = {
  githubPage?: number;
  localPage?: number;
  limit?: number;
};

export async function listRepos(params?: ListReposParams): Promise<ReposPayload> {
  const { data } = await api.get<ReposPayload>('/repos', { params });
  return data;
}

export async function listLocalRepos(): Promise<LocalRepo[]> {
  const { data } = await api.get<LocalRepo[]>('/repos/local');
  return data;
}

export async function cloneRepo(repoFullName: string, branch?: string) {
  const { data } = await api.post<{ repo: LocalRepo; permission: 'read' | 'write' }>('/repos/clone', { repoFullName, branch });
  return data;
}

export async function initRepo(repoName: string, defaultBranch?: string) {
  const { data } = await api.post<{ repo: LocalRepo; permission: 'read' | 'write' }>('/repos/init', { repoName, defaultBranch });
  return data;
}

export async function deleteLocalRepo(name: string) {
  await api.delete(`/repos/local/${encodeURIComponent(name)}`);
}

export async function listRepoPermissions(repoId: string): Promise<RepoPermissionEntry[]> {
  const { data } = await api.get<RepoPermissionEntry[]>(`/repos/${repoId}/permissions`);
  return data;
}

export async function grantRepoAccess(repoId: string, login: string, permission: 'read' | 'write') {
  await api.post(`/repos/${repoId}/permissions`, { login, permission });
}

export async function searchShareUsers(repoId: string, query: string): Promise<ShareUserCandidate[]> {
  const { data } = await api.get<ShareUserCandidate[]>(`/repos/${repoId}/share-users`, {
    params: { query },
  });
  return data;
}

export async function revokeRepoAccess(repoId: string, userId: string) {
  await api.delete(`/repos/${repoId}/permissions/${encodeURIComponent(userId)}`);
}
