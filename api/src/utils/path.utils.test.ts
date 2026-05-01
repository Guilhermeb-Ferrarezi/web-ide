import { describe, it, expect } from 'bun:test';
import path from 'node:path';
import {
  sanitizeRepoName,
  sanitizeUserId,
  getWorkspacePath,
  resolveSafe,
} from './path.utils.ts';

describe('sanitizeRepoName', () => {
  it('aceita nomes válidos', () => {
    expect(sanitizeRepoName('my-repo')).toBe('my-repo');
    expect(sanitizeRepoName('my_repo.v2')).toBe('my_repo.v2');
    expect(sanitizeRepoName('Repo123')).toBe('Repo123');
  });

  it('remove caracteres perigosos', () => {
    expect(sanitizeRepoName('my repo!')).toBe('myrepo');
    expect(sanitizeRepoName('rep/o')).toBe('repo');
  });

  it('rejeita nomes vazios', () => {
    expect(() => sanitizeRepoName('')).toThrow();
    expect(() => sanitizeRepoName('!!!')).toThrow();
  });

  it('rejeita nomes começando com ponto', () => {
    expect(() => sanitizeRepoName('.git')).toThrow();
    expect(() => sanitizeRepoName('.hidden')).toThrow();
  });

  it('rejeita nomes que começam com ponto (inclui .. e variantes)', () => {
    expect(() => sanitizeRepoName('..repo')).toThrow();
    expect(() => sanitizeRepoName('..')).toThrow();
    expect(() => sanitizeRepoName('.foo')).toThrow();
  });

  it('rejeita nomes muito longos', () => {
    expect(() => sanitizeRepoName('a'.repeat(101))).toThrow();
  });
});

describe('sanitizeUserId', () => {
  it('mantém alfanuméricos, hífen e underscore', () => {
    expect(sanitizeUserId('user-123')).toBe('user-123');
    expect(sanitizeUserId('user_42')).toBe('user_42');
  });

  it('remove outros caracteres', () => {
    expect(sanitizeUserId('user/123')).toBe('user123');
    expect(sanitizeUserId('us..er')).toBe('user');
  });

  it('rejeita ids vazios após sanitizar', () => {
    expect(() => sanitizeUserId('')).toThrow();
    expect(() => sanitizeUserId('///')).toThrow();
  });
});

describe('getWorkspacePath', () => {
  it('compõe path absoluto a partir de root, user e repo', () => {
    const result = getWorkspacePath('/data/workspaces', 'alice', 'my-repo');
    expect(result).toBe(path.join('/data/workspaces', 'alice', 'my-repo'));
  });

  it('falha quando repoName é inválido', () => {
    expect(() => getWorkspacePath('/data', 'alice', '..')).toThrow();
  });
});

describe('resolveSafe', () => {
  const root = '/tmp/workspace';

  it('resolve subpath válido', () => {
    expect(resolveSafe(root, 'src/index.ts')).toBe(path.resolve(root, 'src/index.ts'));
  });

  it('resolve raiz quando path vazio', () => {
    expect(resolveSafe(root, '')).toBe(path.resolve(root));
  });

  it('bloqueia path traversal com ../', () => {
    expect(() => resolveSafe(root, '../etc/passwd')).toThrow('Path traversal');
    expect(() => resolveSafe(root, '../../etc/passwd')).toThrow('Path traversal');
  });

  it('bloqueia path absoluto fora do root', () => {
    expect(() => resolveSafe(root, '/etc/passwd')).toThrow('Path traversal');
  });

  it('bloqueia path traversal aninhado', () => {
    expect(() => resolveSafe(root, 'src/../../etc/passwd')).toThrow('Path traversal');
  });

  it('aceita normalização que continua dentro do root', () => {
    expect(resolveSafe(root, 'src/./index.ts')).toBe(path.resolve(root, 'src/index.ts'));
    expect(resolveSafe(root, 'src/../index.ts')).toBe(path.resolve(root, 'index.ts'));
  });

  it('rejeita prefixo coincidente fora do root', () => {
    // /tmp/workspace2 começa como /tmp/workspace mas é outro diretório
    expect(() => resolveSafe('/tmp/workspace', '../workspace2/file')).toThrow('Path traversal');
  });
});
