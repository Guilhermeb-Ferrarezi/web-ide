import { simpleGit, type SimpleGit } from 'simple-git';

function git(workspacePath: string): SimpleGit {
  return simpleGit({ baseDir: workspacePath });
}

export type GitCommitAuthor = {
  githubUserId?: string;
  login?: string;
  name?: string;
  email?: string | null;
};

function buildCommitEmail(author?: GitCommitAuthor): string | null {
  if (author?.email && author.email.trim()) return author.email.trim();
  if (author?.githubUserId && author?.login) {
    return `${author.githubUserId}+${author.login}@users.noreply.github.com`;
  }
  return null;
}

async function ensureCommitIdentity(g: SimpleGit, author?: GitCommitAuthor) {
  const name = author?.name?.trim() || author?.login?.trim();
  const email = buildCommitEmail(author);
  if (!name || !email) return;
  await g.addConfig('user.name', name);
  await g.addConfig('user.email', email);
  await g.addConfig('commit.gpgsign', 'false');
}

export type GitFileStatus = {
  path: string;
  index: string;
  workingDir: string;
  staged: boolean;
  unstaged: boolean;
};

export type GitStatusResult = {
  branch: string | null;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
};

export async function getStatus(workspacePath: string): Promise<GitStatusResult> {
  const s = await git(workspacePath).status();
  const map = (entries: { path: string; index: string; working_dir: string }[]): GitFileStatus[] =>
    entries.map((f) => ({
      path: f.path,
      index: f.index,
      workingDir: f.working_dir,
      staged: f.index !== ' ' && f.index !== '?',
      unstaged: f.working_dir !== ' ',
    }));
  const staged = map(s.files.filter((f) => f.index !== ' ' && f.index !== '?'));
  const unstaged = map(s.files.filter((f) => f.working_dir !== ' ' && f.index !== '?'));
  return {
    branch: s.current,
    ahead: s.ahead,
    behind: s.behind,
    staged,
    unstaged,
    untracked: s.not_added,
  };
}

export async function getDiff(workspacePath: string, file?: string, staged = false): Promise<string> {
  const args: string[] = [];
  if (staged) args.push('--cached');
  if (file) args.push('--', file);
  return git(workspacePath).diff(args);
}

export async function getLog(workspacePath: string, limit = 20) {
  const log = await git(workspacePath).log({ maxCount: limit });
  return log.all.map((c) => ({
    hash: c.hash,
    abbreviated: c.hash.slice(0, 7),
    date: c.date,
    message: c.message,
    author: c.author_name,
  }));
}

export async function getBranches(workspacePath: string) {
  const b = await git(workspacePath).branchLocal();
  return { current: b.current, all: b.all };
}

export async function addFiles(workspacePath: string, files: string[]) {
  await git(workspacePath).add(files);
}

export async function unstageFiles(workspacePath: string, files: string[]) {
  await git(workspacePath).reset(['HEAD', '--', ...files]);
}

export async function untrackFiles(workspacePath: string, files: string[]) {
  await git(workspacePath).raw(['rm', '--cached', '--', ...files]);
}

export async function commit(workspacePath: string, message: string, author?: GitCommitAuthor) {
  const g = git(workspacePath);
  await ensureCommitIdentity(g, author);
  return g.commit(message);
}

export async function push(workspacePath: string, accessToken: string) {
  const g = git(workspacePath);
  const remotes = await g.getRemotes(true);
  const origin = remotes.find((r) => r.name === 'origin');
  if (!origin) throw new Error('No origin remote');

  const publicUrl = origin.refs.push;
  const authUrl = publicUrl.replace('https://', `https://x-access-token:${accessToken}@`);

  try {
    await g.remote(['set-url', 'origin', authUrl]);
    const result = await g.push();
    return result;
  } finally {
    await g.remote(['set-url', 'origin', publicUrl]);
  }
}

export async function pull(workspacePath: string, accessToken: string) {
  const g = git(workspacePath);
  const remotes = await g.getRemotes(true);
  const origin = remotes.find((r) => r.name === 'origin');
  if (!origin) throw new Error('No origin remote');

  const publicUrl = origin.refs.fetch;
  const authUrl = publicUrl.replace('https://', `https://x-access-token:${accessToken}@`);

  try {
    await g.remote(['set-url', 'origin', authUrl]);
    return await g.pull();
  } finally {
    await g.remote(['set-url', 'origin', publicUrl]);
  }
}

export async function checkout(workspacePath: string, branch: string, create = false) {
  const g = git(workspacePath);
  if (create) await g.checkoutLocalBranch(branch);
  else await g.checkout(branch);
}
