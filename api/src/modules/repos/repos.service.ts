import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { config } from '../../config.ts';
import { createOctokit } from '../../utils/octokit.ts';
import { db } from '../../db/client.ts';
import { repoPermissions, repos } from '../../db/schema.ts';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getSharedRepoPath, getSharedReposRoot, sanitizeRepoName } from '../../utils/path.utils.ts';
import { grantRepoPermission } from '../permissions/permissions.service.ts';
import { ensureImportedRepo } from './repo-catalog.service.ts';

const execAsync = promisify(exec);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(dir: string): Promise<string | null> {
  if (!(await fileExists(path.join(dir, 'package.json')))) return null;
  if (await fileExists(path.join(dir, 'bun.lock'))) return 'bun';
  if (await fileExists(path.join(dir, 'bun.lockb'))) return 'bun';
  if (await fileExists(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function getWorkspacePatterns(dir: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(dir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw);
    if (Array.isArray(pkg.workspaces)) return pkg.workspaces;
    if (Array.isArray(pkg.workspaces?.packages)) return pkg.workspaces.packages;
  } catch {}
  return [];
}

function matchesWorkspacePattern(relDir: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return relDir === prefix || relDir.startsWith(prefix + '/');
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      const parts = relDir.split('/');
      const prefixParts = prefix.split('/');
      return parts.length === prefixParts.length + 1 && relDir.startsWith(prefix + '/');
    }
    return relDir === pattern;
  });
}

async function findIndependentPackages(rootDir: string, workspacePatterns: string[], depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const results: string[] = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const subDir = path.join(rootDir, entry.name);
    const relDir = path.relative(rootDir, subDir);
    if (await fileExists(path.join(subDir, 'package.json'))) {
      if (!matchesWorkspacePattern(relDir, workspacePatterns)) {
        results.push(subDir);
      }
    }
    results.push(...(await findIndependentPackages(subDir, workspacePatterns, depth + 1)));
  }
  return results;
}

const INSTALL_COMMANDS: Record<string, string> = {
  bun: 'bun install',
  pnpm: 'pnpm install --ignore-scripts',
  yarn: 'yarn install --ignore-scripts',
  npm: 'npm install --ignore-scripts',
};

async function installAt(dir: string): Promise<void> {
  const pm = await detectPackageManager(dir);
  if (!pm) return;
  await execAsync(INSTALL_COMMANDS[pm], { cwd: dir, timeout: 120_000 });
}

async function installDependencies(dir: string): Promise<void> {
  await installAt(dir);

  const workspacePatterns = await getWorkspacePatterns(dir);
  const independentPkgs = await findIndependentPackages(dir, workspacePatterns);
  for (const pkgDir of independentPkgs) {
    await installAt(pkgDir);
  }
}

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
  canManage: boolean;
};

export type ReposPayload = {
  githubRepos: RemoteRepo[];
  localRepos: LocalRepo[];
  githubPagination: RepoPagination;
  localPagination: RepoPagination;
};

export type RepoPagination = {
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ListReposOptions = {
  githubPage: number;
  localPage: number;
  limit: number;
};

async function listAccessibleGithubFullNames(userId: string): Promise<string[]> {
  const rows = await db
    .select({ githubFullName: repos.githubFullName })
    .from(repoPermissions)
    .innerJoin(repos, eq(repoPermissions.repoId, repos.id))
    .where(eq(repoPermissions.userId, userId));

  return rows.map((row) => row.githubFullName);
}

export async function listRemoteRepos(
  accessToken: string,
  userId: string,
  pagination: RepoPaginationInput,
): Promise<{ items: RemoteRepo[]; pagination: RepoPagination }> {
  const octokit = createOctokit(accessToken);
  const { data } = await octokit.repos.listForAuthenticatedUser({
    per_page: pagination.limit + 1,
    page: pagination.page,
    sort: 'updated',
    affiliation: 'owner,collaborator',
  });

  const local = new Set(await listAccessibleGithubFullNames(userId));

  return {
    items: data.slice(0, pagination.limit).map((r) => ({
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
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      hasMore: data.length > pagination.limit,
    },
  };
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
    canManage: repo.createdByUserId === userId,
  }));
}

type RepoPaginationInput = {
  page: number;
  limit: number;
};

export async function listLocalReposPage(
  userId: string,
  pagination: RepoPaginationInput,
): Promise<{ items: LocalRepo[]; pagination: RepoPagination }> {
  const rows = await db
    .select({
      id: repos.id,
      slug: repos.slug,
      githubFullName: repos.githubFullName,
      path: repos.storagePath,
      createdByUserId: repos.createdByUserId,
      permission: repoPermissions.permission,
    })
    .from(repoPermissions)
    .innerJoin(repos, eq(repoPermissions.repoId, repos.id))
    .where(eq(repoPermissions.userId, userId))
    .orderBy(asc(repos.githubFullName))
    .limit(pagination.limit + 1)
    .offset((pagination.page - 1) * pagination.limit);

  return {
    items: rows.slice(0, pagination.limit).map((row) => ({
      id: row.id,
      slug: row.slug,
      githubFullName: row.githubFullName,
      permission: row.permission,
      path: row.path,
      canManage: row.createdByUserId === userId,
    })),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      hasMore: rows.length > pagination.limit,
    },
  };
}

export async function listReposForUser(
  accessToken: string,
  userId: string,
  options: ListReposOptions,
): Promise<ReposPayload> {
  const [githubRepos, localRepos] = await Promise.all([
    listRemoteRepos(accessToken, userId, { page: options.githubPage, limit: options.limit }),
    listLocalReposPage(userId, { page: options.localPage, limit: options.limit }),
  ]);

  return {
    githubRepos: githubRepos.items,
    localRepos: localRepos.items,
    githubPagination: githubRepos.pagination,
    localPagination: localRepos.pagination,
  };
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
        canManage: existing.createdByUserId === opts.userId,
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
  let cloned = false;
  try {
    await fs.access(repoRecord.storagePath);
  } catch {
    await git.clone(authUrl, repoRecord.storagePath, args);
    cloned = true;
  }

  if (cloned) {
    await installDependencies(repoRecord.storagePath);
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
      canManage: true,
    },
    permission: 'write',
  };
}

export async function initRepo(opts: {
  userId: string;
  userLogin: string;
  repoName: string;
  defaultBranch?: string;
}): Promise<{ repo: LocalRepo; permission: 'read' | 'write' }> {
  const sanitized = sanitizeRepoName(opts.repoName.toLowerCase());
  if (!sanitized) throw new Error('Nome inválido');

  const githubFullName = `${opts.userLogin}/${sanitized}`;
  const branch = opts.defaultBranch ?? 'main';

  const existing = await db.query.repos.findFirst({
    where: eq(repos.githubFullName, githubFullName),
  });
  if (existing) throw new Error('Já existe um repositório com esse nome');

  let slug = sanitized;
  let n = 1;
  while (await db.query.repos.findFirst({ where: eq(repos.slug, slug) })) {
    n += 1;
    slug = `${sanitized}-${n}`;
  }

  await fs.mkdir(getSharedReposRoot(config.WORKSPACES_ROOT), { recursive: true });
  const storagePath = getSharedRepoPath(config.WORKSPACES_ROOT, slug);
  await fs.mkdir(storagePath, { recursive: true });

  const git = simpleGit(storagePath);
  await git.init();
  await git.addConfig('user.name', opts.userLogin);
  await git.addConfig('user.email', `${opts.userLogin}@users.noreply.github.com`);
  await git.raw(['checkout', '-b', branch]);
  await fs.writeFile(path.join(storagePath, 'README.md'), `# ${sanitized}\n`);
  await git.add('.');
  await git.commit('Initial commit');

  const [repoRecord] = await db
    .insert(repos)
    .values({
      slug,
      githubFullName,
      githubOwner: opts.userLogin,
      githubName: sanitized,
      defaultBranch: branch,
      storagePath,
      createdByUserId: opts.userId,
    })
    .returning();

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
      canManage: true,
    },
    permission: 'write',
  };
}

export async function deleteLocalRepo(userId: string, repoName: string): Promise<void> {
  const repo = await db.query.repos.findFirst({
    where: eq(repos.slug, repoName),
  });
  if (!repo) return;

  if (repo.createdByUserId === userId) {
    await fs.rm(repo.storagePath, { recursive: true, force: true });
    await db.delete(repos).where(eq(repos.id, repo.id));
    return;
  }

  await db.delete(repoPermissions).where(and(eq(repoPermissions.repoId, repo.id), eq(repoPermissions.userId, userId)));
}
