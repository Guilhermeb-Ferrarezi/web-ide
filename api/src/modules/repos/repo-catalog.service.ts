import fs from 'node:fs/promises';
import { and, eq, ilike, not } from 'drizzle-orm';
import { db } from '../../db/client.ts';
import { repos } from '../../db/schema.ts';
import { config } from '../../config.ts';
import { getSharedRepoPath, getSharedReposRoot, sanitizeRepoName } from '../../utils/path.utils.ts';

function baseSlugFromGithubName(name: string) {
  return sanitizeRepoName(name.toLowerCase());
}

async function createUniqueSlug(rawName: string) {
  const base = baseSlugFromGithubName(rawName);
  let slug = base;
  let n = 1;

  while (await db.query.repos.findFirst({ where: eq(repos.slug, slug) })) {
    n += 1;
    slug = `${base}-${n}`;
  }

  return slug;
}

export async function ensureSharedReposRoot() {
  await fs.mkdir(getSharedReposRoot(config.WORKSPACES_ROOT), { recursive: true });
}

export async function ensureImportedRepo(input: {
  githubFullName: string;
  defaultBranch: string;
  importingUserId: string;
}) {
  const existing = await db.query.repos.findFirst({
    where: eq(repos.githubFullName, input.githubFullName),
  });
  if (existing) return existing;

  const [githubOwner, githubName] = input.githubFullName.split('/');
  if (!githubOwner || !githubName) {
    throw new Error('Invalid repoFullName');
  }

  await ensureSharedReposRoot();
  const slug = await createUniqueSlug(githubName);
  const storagePath = getSharedRepoPath(config.WORKSPACES_ROOT, slug);

  const [repo] = await db
    .insert(repos)
    .values({
      slug,
      githubFullName: input.githubFullName,
      githubOwner,
      githubName,
      defaultBranch: input.defaultBranch,
      storagePath,
      createdByUserId: input.importingUserId,
    })
    .returning();

  return repo;
}

export async function findRepoBySlug(slug: string) {
  return db.query.repos.findFirst({
    where: eq(repos.slug, slug),
  });
}
