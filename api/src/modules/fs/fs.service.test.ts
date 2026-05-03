import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  collectTypeDefs,
  readTree,
  readFile,
  searchFiles,
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

  it('ignora node_modules e .git, mas lista pastas ocultas comuns do projeto', async () => {
    await fs.mkdir(path.join(workspace, 'node_modules'));
    await fs.mkdir(path.join(workspace, '.git'));
    await fs.mkdir(path.join(workspace, '.next'));
    await fs.mkdir(path.join(workspace, 'src'));
    const tree = await readTree(workspace);
    expect(tree.map((n) => n.name)).toEqual(['.next', 'src']);
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

  it('lê dotfiles e arquivos sem extensão conhecida como utf-8', async () => {
    await writeFile(workspace, '.env.local', 'TOKEN=abc');
    await writeFile(workspace, 'Dockerfile', 'FROM node:22');
    const envFile = await readFile(workspace, '.env.local');
    const dockerfile = await readFile(workspace, 'Dockerfile');
    expect(envFile.encoding).toBe('utf-8');
    expect(envFile.content).toBe('TOKEN=abc');
    expect(dockerfile.encoding).toBe('utf-8');
    expect(dockerfile.content).toBe('FROM node:22');
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

describe('searchFiles', () => {
  it('retorna arquivos e linhas com correspondências de texto', async () => {
    await writeFile(workspace, 'src/a.ts', 'const hello = "world";\nconsole.log(hello);');
    await writeFile(workspace, 'README.md', 'hello docs');
    const results = await searchFiles(workspace, 'hello');
    expect(results.map((entry) => entry.path)).toEqual(['README.md', 'src/a.ts']);
    expect(results[0]?.matches[0]?.line).toBe(1);
    expect(results[1]?.matches[0]?.preview).toContain('const hello');
  });

  it('ignora arquivos binários', async () => {
    await fs.writeFile(path.join(workspace, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const results = await searchFiles(workspace, 'png');
    expect(results).toEqual([]);
  });
});

describe('collectTypeDefs', () => {
  it('prefere tipagens reais da dependencia e nao injeta fallback generico por cima', async () => {
    await fs.writeFile(
      path.join(workspace, 'package.json'),
      JSON.stringify({
        dependencies: {
          'react-router-dom': '6.30.3',
        },
      }),
    );
    await fs.mkdir(path.join(workspace, 'node_modules', 'react-router-dom', 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'node_modules', 'react-router-dom', 'package.json'),
      JSON.stringify({
        name: 'react-router-dom',
        types: './dist/index.d.ts',
      }),
    );
    await fs.writeFile(
      path.join(workspace, 'node_modules', 'react-router-dom', 'dist', 'index.d.ts'),
      "export declare function Navigate(): null;\n",
    );

    const types = await collectTypeDefs(workspace);

    expect(types.some((entry) => entry.virtualPath.endsWith('react-router-dom/dist/index.d.ts'))).toBe(true);
    expect(types.some((entry) => entry.virtualPath.endsWith('react-router-dom/__monaco__.d.ts'))).toBe(true);
    expect(types.some((entry) => entry.virtualPath.includes('__generated__/react-router-dom.d.ts'))).toBe(false);
  });

  it('mantem fallback generico para dependencias sem tipagem', async () => {
    await fs.writeFile(
      path.join(workspace, 'package.json'),
      JSON.stringify({
        dependencies: {
          'some-untyped-package': '1.0.0',
        },
      }),
    );
    await fs.mkdir(path.join(workspace, 'node_modules', 'some-untyped-package'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'node_modules', 'some-untyped-package', 'package.json'),
      JSON.stringify({
        name: 'some-untyped-package',
      }),
    );

    const types = await collectTypeDefs(workspace);

    expect(types.some((entry) => entry.virtualPath.includes('__generated__/some-untyped-package.d.ts'))).toBe(true);
  });

  it('cria shim de modulo runtime quando a tipagem vem de @types', async () => {
    await fs.writeFile(
      path.join(workspace, 'package.json'),
      JSON.stringify({
        dependencies: {
          react: '18.3.1',
        },
      }),
    );
    await fs.mkdir(path.join(workspace, 'node_modules', '@types', 'react'), { recursive: true });
    await fs.writeFile(
      path.join(workspace, 'node_modules', '@types', 'react', 'index.d.ts'),
      'export declare function useState<T>(value: T): [T, (next: T) => void];\n',
    );
    await fs.writeFile(
      path.join(workspace, 'node_modules', '@types', 'react', 'jsx-runtime.d.ts'),
      'export declare const Fragment: unique symbol;\n',
    );

    const types = await collectTypeDefs(workspace);

    expect(types.some((entry) => entry.virtualPath.endsWith('@types/react/index.d.ts'))).toBe(true);
    expect(types.some((entry) => entry.virtualPath.endsWith('node_modules/react/__monaco__.d.ts'))).toBe(true);
    expect(types.some((entry) => entry.virtualPath.includes('__generated__/react.d.ts'))).toBe(false);
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
