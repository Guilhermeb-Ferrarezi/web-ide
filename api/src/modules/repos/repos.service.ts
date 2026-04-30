import fs from 'node:fs/promises';
import { simpleGit } from 'simple-git';
import { config } from '../../config.ts';
import { createOctokit } from '../../utils/octokit.ts';
import { getUserWorkspacesDir, getWorkspacePath, sanitizeRepoName } from '../../utils/path.utils.ts';

export type RemoteRepo = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  cloneUrl: string;
  defaultBranch: string;
  updatedAt: string | null;
  description: string | null;
  language: string | null;
  cloned: boolean;
};

export type LocalRepo = {
  name: string;
  path: string;
};

export async function listRemoteRepos(accessToken: string, userId: string): Promise<RemoteRepo[]> {
  const octokit = createOctokit(accessToken);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: 'updated',
    affiliation: 'owner,collaborator',
  });

  const local = new Set((await listLocalRepos(userId)).map((r) => r.name));

  return data.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    private: r.private,
    cloneUrl: r.clone_url ?? '',
    defaultBranch: r.default_branch ?? 'main',
    updatedAt: r.updated_at,
    description: r.description,
    language: r.language,
    cloned: local.has(sanitizeRepoName(r.name)),
  }));
}

export async function listLocalRepos(userId: string): Promise<LocalRepo[]> {
  const dir = getUserWorkspacesDir(config.WORKSPACES_ROOT, userId);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => ({ name: e.name, path: `${dir}/${e.name}` }));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function cloneRepo(opts: {
  userId: string;
  accessToken: string;
  repoFullName: string;
  branch?: string;
}): Promise<{ name: string; path: string }> {
  const [owner, rawName] = opts.repoFullName.split('/');
  if (!owner || !rawName) throw new Error('Invalid repoFullName');
  const name = sanitizeRepoName(rawName);

  const userDir = getUserWorkspacesDir(config.WORKSPACES_ROOT, opts.userId);
  await fs.mkdir(userDir, { recursive: true });

  const target = getWorkspacePath(config.WORKSPACES_ROOT, opts.userId, name);

  try {
    await fs.access(target);
    throw new Error('Repository already cloned');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT' && (err as Error).message !== 'Repository already cloned') {
      throw err;
    }
    if ((err as Error).message === 'Repository already cloned') throw err;
  }

  const authUrl = `https://x-access-token:${opts.accessToken}@github.com/${owner}/${name}.git`;
  const git = simpleGit();
  const args = opts.branch ? ['--branch', opts.branch, '--single-branch'] : [];

  await git.clone(authUrl, target, args);

  const repoGit = simpleGit(target);
  await repoGit.remote(['set-url', 'origin', `https://github.com/${owner}/${name}.git`]);

  return { name, path: target };
}

export async function deleteLocalRepo(userId: string, repoName: string): Promise<void> {
  const target = getWorkspacePath(config.WORKSPACES_ROOT, userId, repoName);
  await fs.rm(target, { recursive: true, force: true });
}
