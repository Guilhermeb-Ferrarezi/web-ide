import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { simpleGit } from 'simple-git';
import {
  getStatus,
  getLog,
  getBranches,
  addFiles,
  unstageFiles,
  commit,
  checkout,
} from './git.service.ts';

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'git-svc-'));
  const g = simpleGit({ baseDir: workspace });
  await g.init();
  await g.addConfig('user.email', 'test@test.dev');
  await g.addConfig('user.name', 'Test');
  await g.addConfig('commit.gpgsign', 'false');
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

async function writeFile(name: string, content: string) {
  await fs.writeFile(path.join(workspace, name), content);
}

describe('getStatus', () => {
  it('retorna untracked para arquivos novos', async () => {
    await writeFile('a.txt', 'a');
    const s = await getStatus(workspace);
    expect(s.untracked).toContain('a.txt');
    expect(s.staged).toEqual([]);
  });

  it('retorna staged após add', async () => {
    await writeFile('a.txt', 'a');
    await addFiles(workspace, ['a.txt']);
    const s = await getStatus(workspace);
    expect(s.staged.map((f) => f.path)).toContain('a.txt');
    expect(s.untracked).not.toContain('a.txt');
  });

  it('retorna unstaged após modificar arquivo commitado', async () => {
    await writeFile('a.txt', 'a');
    await addFiles(workspace, ['a.txt']);
    await commit(workspace, 'init');
    await writeFile('a.txt', 'modified');
    const s = await getStatus(workspace);
    expect(s.unstaged.map((f) => f.path)).toContain('a.txt');
  });
});

describe('addFiles / unstageFiles / commit', () => {
  it('add → commit limpa o status', async () => {
    await writeFile('a.txt', 'a');
    await addFiles(workspace, ['a.txt']);
    const result = await commit(workspace, 'first');
    expect(result.commit).toBeTruthy();
    const s = await getStatus(workspace);
    expect(s.staged).toEqual([]);
    expect(s.untracked).toEqual([]);
  });

  it('unstage retira do índice (volta a untracked se novo)', async () => {
    await writeFile('a.txt', 'a');
    await addFiles(workspace, ['a.txt']);
    await unstageFiles(workspace, ['a.txt']);
    const s = await getStatus(workspace);
    expect(s.staged).toEqual([]);
    expect(s.untracked).toContain('a.txt');
  });
});

describe('getLog', () => {
  it('retorna lista vazia em repo sem commits', async () => {
    const log = await getLog(workspace).catch(() => []);
    expect(Array.isArray(log)).toBe(true);
  });

  it('retorna commits ordem decrescente', async () => {
    await writeFile('a.txt', '1');
    await addFiles(workspace, ['a.txt']);
    await commit(workspace, 'first');
    await writeFile('a.txt', '2');
    await addFiles(workspace, ['a.txt']);
    await commit(workspace, 'second');
    const log = await getLog(workspace, 5);
    expect(log).toHaveLength(2);
    expect(log[0].message).toBe('second');
    expect(log[1].message).toBe('first');
    expect(log[0].abbreviated).toHaveLength(7);
  });
});

describe('getBranches / checkout', () => {
  it('cria e troca para nova branch', async () => {
    await writeFile('a.txt', 'a');
    await addFiles(workspace, ['a.txt']);
    await commit(workspace, 'init');
    await checkout(workspace, 'feature/x', true);
    const b = await getBranches(workspace);
    expect(b.current).toBe('feature/x');
    expect(b.all).toContain('feature/x');
  });
});
