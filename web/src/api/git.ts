import { api } from './client';
import type { GitStatus } from '@/types';

export async function fetchStatus(workspace: string): Promise<GitStatus> {
  const { data } = await api.get<GitStatus>('/git/status', { params: { workspace } });
  return data;
}

export async function fetchDiff(workspace: string, file?: string, staged = false) {
  const { data } = await api.get<{ diff: string }>('/git/diff', {
    params: { workspace, file, staged: staged || undefined },
  });
  return data.diff;
}

export async function fetchBranches(workspace: string) {
  const { data } = await api.get<{ current: string; all: string[] }>('/git/branches', {
    params: { workspace },
  });
  return data;
}

export async function gitAdd(workspace: string, files: string[]) {
  await api.post('/git/add', { workspace, files });
}

export async function gitUnstage(workspace: string, files: string[]) {
  await api.post('/git/unstage', { workspace, files });
}

export async function gitCommit(workspace: string, message: string) {
  await api.post('/git/commit', { workspace, message });
}

export async function gitPush(workspace: string) {
  await api.post('/git/push', { workspace });
}

export async function gitPull(workspace: string) {
  await api.post('/git/pull', { workspace });
}

export async function gitCheckout(workspace: string, branch: string, create = false) {
  await api.post('/git/checkout', { workspace, branch, create });
}
