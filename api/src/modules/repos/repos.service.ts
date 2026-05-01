import fs from 'node:fs/promises';
import { simpleGit } from 'simple-git';
import { config } from '../../config.ts';
import { createOctokit } from '../../utils/octokit.ts';
import { db } from '../../db/client.ts';
import { repoPermissions, repos } from '../../db/schema.ts';
import { and, eq, inArray } from 'drizzle-orm';
import { getSharedReposRoot, sanitizeRepoName } from '../../utils/path.utils.ts';
import { grantRepoPermission } from '../permissions/permissions.service.ts';
import { ensureImportedRepo } from './repo-catalog.service.ts';

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
  id: string;
  slug: string;
  githubFullName: string;
  permission: 'read' | 'write';
  path: string;
};

export type ReposPayload = {
  githubRepos: RemoteRepo[];
  localRepos: LocalRepo[];
};

export async function listRemoteRepos(accessToken: string, userId: string): Promise<RemoteRepo[]> {
  const octokit = createOctokit(accessToken);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: 100,
    sort: 'updated',
    affiliation: 'owner,collaborator',
  });

  const local = new Set((await listLocalRepos(userId)).map((r) => r.githubFullName));

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
    cloned: local.has(r.full_name),
  }));
}

export async function listLocalRepos(userId: string): Promise<LocalRepo[]> {
  const permissions = await db.query.repoPermissions.findMany({
    where: eq(repoPermissions.userId, userId),
  });
  if (permissions.length === 0) return [];

  const repoIds = permissions.map((p) => p.repoId);
  const repoRows = await db.query.repos.findMany({
    where: inArray(repos.id, repoIds),
  });
  const permissionByRepoId = new Map(permissions.map((p) => [p.repoId, p.permission]));

  return repoRows.map((repo) => ({
    id: repo.id,
    slug: repo.slug,
    githubFullName: repo.githubFullName,
    permission: permissionByRepoId.get(repo.id) ?? 'read',
    path: repo.storagePath,
  }));
}

export async function listReposForUser(accessToken: string, userId: string): Promise<ReposPayload> {
  const [githubRepos, localRepos] = await Promise.all([
    listRemoteRepos(accessToken, userId),
    listLocalRepos(userId),
  ]);
  return { githubRepos, localRepos };
}

export async function importRepo(opts: {
  userId: string;
  accessToken: string;
  repoFullName: string;
  branch?: string;
}): Promise<{ repo: LocalRepo; permission: 'read' | 'write' }> {
  const existing = await db.query.repos.findFirst({
    where: eq(repos.githubFullName, opts.repoFullName),
  });

  if (existing) {
    const currentPermission = await db.query.repoPermissions.findFirst({
      where: and(eq(repoPermissions.repoId, existing.id), eq(repoPermissions.userId, opts.userId)),
    });
    if (!currentPermission) {
      await grantRepoPermission({
        repoId: existing.id,
        userId: opts.userId,
        permission: 'read',
        createdByUserId: opts.userId,
      });
    }
    return {
      repo: {
        id: existing.id,
        slug: existing.slug,
        githubFullName: existing.githubFullName,
        permission: currentPermission?.permission ?? 'read',
        path: existing.storagePath,
      },
      permission: currentPermission?.permission ?? 'read',
    };
  }

  const [owner, rawName] = opts.repoFullName.split('/');
  if (!owner || !rawName) throw new Error('Invalid repoFullName');
  const name = sanitizeRepoName(rawName);
  await fs.mkdir(getSharedReposRoot(config.WORKSPACES_ROOT), { recursive: true });
  const repoRecord = await ensureImportedRepo({
    githubFullName: opts.repoFullName,
    defaultBranch: opts.branch ?? 'main',
    importingUserId: opts.userId,
  });
  const authUrl = `https://x-access-token:${opts.accessToken}@github.com/${owner}/${name}.git`;
  const git = simpleGit();
  const args = opts.branch ? ['--branch', opts.branch, '--single-branch'] : [];
  try {
    await fs.access(repoRecord.storagePath);
  } catch {
    await git.clone(authUrl, repoRecord.storagePath, args);
  }

  const repoGit = simpleGit(repoRecord.storagePath);
  await repoGit.remote(['set-url', 'origin', `https://github.com/${owner}/${name}.git`]);
  await grantRepoPermission({
    repoId: repoRecord.id,
    userId: opts.userId,
    permission: 'write',
    createdByUserId: opts.userId,
  });

  return {
    repo: {
      id: repoRecord.id,
      slug: repoRecord.slug,
      githubFullName: repoRecord.githubFullName,
      permission: 'write',
      path: repoRecord.storagePath,
    },
    permission: 'write',
  };
}

export async function deleteLocalRepo(userId: string, repoName: string): Promise<void> {
  const repo = await db.query.repos.findFirst({
    where: eq(repos.slug, repoName),
  });
  if (!repo) return;
  await db.delete(repoPermissions).where(and(eq(repoPermissions.repoId, repo.id), eq(repoPermissions.userId, userId)));
}
