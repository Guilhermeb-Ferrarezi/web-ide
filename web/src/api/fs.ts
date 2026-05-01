import { api } from './client';
import type { CodeSearchOptions, CodeSearchResult, EditorProjectFile, FileContent, TreeNode } from '@/types';

export async function fetchTree(workspace: string): Promise<TreeNode[]> {
  const { data } = await api.get<TreeNode[]>('/fs/tree', { params: { workspace } });
  return data;
}

export async function fetchFile(workspace: string, path: string): Promise<FileContent> {
  const { data } = await api.get<FileContent>('/fs/file', { params: { workspace, path } });
  return data;
}

export async function searchFiles(
  workspace: string,
  query: string,
  options: CodeSearchOptions = {},
): Promise<CodeSearchResult[]> {
  const params: Record<string, string> = { workspace, query };
  if (options.caseSensitive) params.caseSensitive = 'true';
  if (options.wholeWord) params.wholeWord = 'true';
  if (options.regex) params.regex = 'true';
  const { data } = await api.get<CodeSearchResult[]>('/fs/search', { params });
  return data;
}

export async function saveFile(workspace: string, path: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8') {
  await api.put('/fs/file', { workspace, path, content, encoding });
}

export async function deleteFile(workspace: string, path: string) {
  await api.delete('/fs/file', { params: { workspace, path } });
}

export async function mkdir(workspace: string, path: string) {
  await api.post('/fs/mkdir', { workspace, path });
}

export async function renamePath(workspace: string, from: string, to: string) {
  await api.post('/fs/rename', { workspace, from, to });
}

export type TypeDef = { virtualPath: string; content: string };

export async function fetchProjectFiles(workspace: string): Promise<EditorProjectFile[]> {
  const { data } = await api.get<EditorProjectFile[]>('/fs/project-files', { params: { workspace } });
  return data;
}

export async function fetchTypes(workspace: string): Promise<TypeDef[]> {
  const { data } = await api.get<TypeDef[]>('/fs/types', { params: { workspace } });
  return data;
}

export async function uploadFile(workspace: string, path: string, file: File) {
  const form = new FormData();
  form.append('path', path);
  form.append('file', file);
  await api.post('/fs/upload', form, {
    params: { workspace },
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
