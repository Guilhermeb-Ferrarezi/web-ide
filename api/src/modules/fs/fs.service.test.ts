import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  readTree,
  readFile,
  writeFile,
  deletePath,
  makeDir,
  renamePath,
  uploadFile,
} from './fs.service.ts';

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-svc-'));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('readTree', () => {
  it('retorna lista vazia quando workspace vazio', async () => {
    const tree = await readTree(workspace);
    expect(tree).toEqual([]);
  });

  it('lista arquivos e diretórios ordenados (dirs primeiro)', async () => {
    await fs.writeFile(path.join(workspace, 'b.txt'), 'b');
    await fs.mkdir(path.join(workspace, 'a-dir'));
    await fs.writeFile(path.join(workspace, 'a-dir', 'inner.txt'), 'inner');
    const tree = await readTree(workspace);
    expect(tree).toHaveLength(2);
    expect(tree[0].type).toBe('directory');
    expect(tree[0].name).toBe('a-dir');
    expect(tree[1].name).toBe('b.txt');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children?.[0].path).toBe('a-dir/inner.txt');
  });

  it('ignora node_modules e .git', async () => {
    await fs.mkdir(path.join(workspace, 'node_modules'));
    await fs.mkdir(path.join(workspace, '.git'));
    await fs.mkdir(path.join(workspace, 'src'));
    const tree = await readTree(workspace);
    expect(tree.map((n) => n.name)).toEqual(['src']);
  });

  it('respeita profundidade máxima', async () => {
    await fs.mkdir(path.join(workspace, 'a/b/c'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'a/b/c/deep.txt'), 'x');
    const tree = await readTree(workspace, 2);
    const a = tree[0];
    const b = a.children?.[0];
    expect(b?.name).toBe('b');
    expect(b?.children).toEqual([]);
  });
});

describe('readFile / writeFile', () => {
  it('grava e lê arquivo de texto utf-8', async () => {
    await writeFile(workspace, 'hello.ts', 'const x = 1;');
    const file = await readFile(workspace, 'hello.ts');
    expect(file.encoding).toBe('utf-8');
    expect(file.content).toBe('const x = 1;');
  });

  it('lê binário como base64', async () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    await fs.writeFile(path.join(workspace, 'img.png'), bytes);
    const file = await readFile(workspace, 'img.png');
    expect(file.encoding).toBe('base64');
    expect(file.mimeType).toBe('image/png');
    expect(Buffer.from(file.content, 'base64')).toEqual(bytes);
  });

  it('cria diretórios pai automaticamente', async () => {
    await writeFile(workspace, 'src/deep/nested.ts', 'x');
    const written = await fs.readFile(path.join(workspace, 'src/deep/nested.ts'), 'utf-8');
    expect(written).toBe('x');
  });

  it('rejeita escrita fora do workspace', async () => {
    await expect(writeFile(workspace, '../escape.txt', 'pwn')).rejects.toThrow('Path traversal');
  });

  it('rejeita arquivo maior que limite', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024);
    await fs.writeFile(path.join(workspace, 'big.bin'), big);
    await expect(readFile(workspace, 'big.bin')).rejects.toThrow();
  });
});

describe('deletePath', () => {
  it('remove arquivo', async () => {
    await writeFile(workspace, 'a.txt', 'x');
    await deletePath(workspace, 'a.txt');
    await expect(fs.access(path.join(workspace, 'a.txt'))).rejects.toThrow();
  });

  it('remove diretório recursivamente', async () => {
    await fs.mkdir(path.join(workspace, 'd/inner'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'd/inner/x.txt'), 'x');
    await deletePath(workspace, 'd');
    await expect(fs.access(path.join(workspace, 'd'))).rejects.toThrow();
  });

  it('proíbe deletar a raiz do workspace', async () => {
    await expect(deletePath(workspace, '')).rejects.toThrow('Cannot delete workspace root');
  });

  it('proíbe traversal', async () => {
    await expect(deletePath(workspace, '../../etc')).rejects.toThrow('Path traversal');
  });
});

describe('makeDir', () => {
  it('cria diretório', async () => {
    await makeDir(workspace, 'new/nested');
    const stat = await fs.stat(path.join(workspace, 'new/nested'));
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('renamePath', () => {
  it('renomeia arquivo', async () => {
    await writeFile(workspace, 'old.txt', 'x');
    await renamePath(workspace, 'old.txt', 'new.txt');
    expect(await fs.readFile(path.join(workspace, 'new.txt'), 'utf-8')).toBe('x');
  });

  it('move para subdiretório (criando)', async () => {
    await writeFile(workspace, 'a.txt', 'x');
    await renamePath(workspace, 'a.txt', 'sub/a.txt');
    expect(await fs.readFile(path.join(workspace, 'sub/a.txt'), 'utf-8')).toBe('x');
  });

  it('rejeita destino fora do workspace', async () => {
    await writeFile(workspace, 'a.txt', 'x');
    await expect(renamePath(workspace, 'a.txt', '../escape.txt')).rejects.toThrow('Path traversal');
  });
});

describe('uploadFile', () => {
  it('persiste buffer', async () => {
    const buf = Buffer.from('binary-content');
    await uploadFile(workspace, 'uploads/file.bin', buf);
    expect(await fs.readFile(path.join(workspace, 'uploads/file.bin'))).toEqual(buf);
  });
});
