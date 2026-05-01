import path from 'node:path';

export function sanitizeRepoName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!clean || clean.startsWith('.') || clean.length > 100) {
    throw new Error('Invalid repo name');
  }
  return clean;
}

export function sanitizeUserId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean) throw new Error('Invalid user id');
  return clean;
}

export function getUserWorkspacesDir(workspacesRoot: string, userId: string): string {
  return path.join(workspacesRoot, sanitizeUserId(userId));
}

export function getWorkspacePath(workspacesRoot: string, userId: string, repoName: string): string {
  return path.join(getUserWorkspacesDir(workspacesRoot, userId), sanitizeRepoName(repoName));
}

export function getSharedReposRoot(workspacesRoot: string): string {
  return path.join(workspacesRoot, 'repos');
}

export function getSharedRepoPath(workspacesRoot: string, slug: string): string {
  return path.join(getSharedReposRoot(workspacesRoot), sanitizeRepoName(slug));
}

export function resolveSafe(rootDir: string, userPath: string): string {
  const normalizedRoot = path.resolve(rootDir);
  const resolved = path.resolve(normalizedRoot, userPath);
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}
