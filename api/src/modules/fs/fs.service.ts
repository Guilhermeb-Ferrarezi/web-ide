import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveSafe } from '../../utils/path.utils.ts';

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
};

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store']);
const MAX_DEPTH = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_TYPEDEF_FILES = 5000;

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'txt', 'css', 'scss', 'sass', 'less',
  'html', 'htm', 'xml', 'svg', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerignore', 'sh',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'sql', 'graphql', 'gql',
  'vue', 'svelte', 'astro', 'prisma', 'lock',
]);

const TEXT_BASENAMES = new Set([
  'dockerfile',
  'makefile',
  'procfile',
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '.gitignore',
  '.dockerignore',
  '.npmrc',
  '.nvmrc',
  '.editorconfig',
  '.prettierrc',
  '.prettierignore',
  '.eslintrc',
  '.eslintignore',
  '.babelrc',
]);

function isProbablyText(filename: string, buf?: Buffer): boolean {
  const lower = filename.toLowerCase();
  if (TEXT_BASENAMES.has(lower)) return true;
  const ext = lower.split('.').pop();
  if (ext && TEXT_EXTENSIONS.has(ext)) return true;
  if (!buf) return false;
  if (buf.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export async function readTree(workspacePath: string, depth = MAX_DEPTH, relPath = ''): Promise<TreeNode[]> {
  if (depth <= 0) return [];
  const fullDir = relPath ? resolveSafe(workspacePath, relPath) : workspacePath;
  const entries = await fs.readdir(fullDir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const childRel = path.posix.join(relPath, entry.name);
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: 'directory',
        children: await readTree(workspacePath, depth - 1, childRel),
      });
    } else if (entry.isFile()) {
      const stat = await fs.stat(path.join(fullDir, entry.name));
      nodes.push({ name: entry.name, path: childRel, type: 'file', size: stat.size });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export type FileContent =
  | { encoding: 'utf-8'; content: string; size: number; mimeType: string }
  | { encoding: 'base64'; content: string; size: number; mimeType: string };

export type SearchMatch = {
  line: number;
  column: number;
  length: number;
  preview: string;
  previewOffset: number;
};

export type SearchOptions = {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
};

export type SearchResult = {
  path: string;
  matches: SearchMatch[];
};

export type EditorProjectFile = {
  path: string;
  content: string;
};

type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  types?: string;
  typings?: string;
};

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
    pdf: 'application/pdf', mp4: 'video/mp4', mp3: 'audio/mpeg',
  };
  return map[ext] ?? 'application/octet-stream';
}

export async function readFile(workspacePath: string, relPath: string): Promise<FileContent> {
  const fullPath = resolveSafe(workspacePath, relPath);
  const stat = await fs.stat(fullPath);
  if (stat.size > MAX_FILE_SIZE) throw new Error('File too large');
  const buf = await fs.readFile(fullPath);
  const name = path.basename(fullPath);
  if (isProbablyText(name, buf)) {
    return { encoding: 'utf-8', content: buf.toString('utf-8'), size: stat.size, mimeType: 'text/plain' };
  }
  return { encoding: 'base64', content: buf.toString('base64'), size: stat.size, mimeType: guessMime(name) };
}

export async function writeFile(workspacePath: string, relPath: string, content: string, encoding: 'utf-8' | 'base64' = 'utf-8') {
  const fullPath = resolveSafe(workspacePath, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  const buf = encoding === 'base64' ? Buffer.from(content, 'base64') : Buffer.from(content, 'utf-8');
  await fs.writeFile(fullPath, buf);
}

export async function deletePath(workspacePath: string, relPath: string) {
  const fullPath = resolveSafe(workspacePath, relPath);
  if (fullPath === workspacePath) throw new Error('Cannot delete workspace root');
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) await fs.rm(fullPath, { recursive: true, force: true });
  else await fs.unlink(fullPath);
}

export async function makeDir(workspacePath: string, relPath: string) {
  const fullPath = resolveSafe(workspacePath, relPath);
  await fs.mkdir(fullPath, { recursive: true });
}

export async function renamePath(workspacePath: string, fromRel: string, toRel: string) {
  const from = resolveSafe(workspacePath, fromRel);
  const to = resolveSafe(workspacePath, toRel);
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

export async function uploadFile(workspacePath: string, relPath: string, buffer: Buffer) {
  const fullPath = resolveSafe(workspacePath, relPath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, buffer);
}

const PREVIEW_MAX = 240;
const PREVIEW_BEFORE = 60;

function buildMatcher(query: string, options: SearchOptions): RegExp {
  const flags = options.caseSensitive ? 'g' : 'gi';
  if (options.regex) {
    return new RegExp(query, flags);
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = options.wholeWord ? `(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])` : escaped;
  return new RegExp(pattern, `${flags}u`);
}

function makePreview(line: string, column: number) {
  if (line.length <= PREVIEW_MAX) {
    return { preview: line, previewOffset: column };
  }
  const start = Math.max(0, column - PREVIEW_BEFORE);
  const end = Math.min(line.length, start + PREVIEW_MAX);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < line.length ? '…' : '';
  const previewOffset = column - start + prefix.length;
  return { preview: `${prefix}${line.slice(start, end)}${suffix}`, previewOffset };
}

async function searchDir(
  workspacePath: string,
  matcher: RegExp,
  depth: number,
  relPath = '',
  results: SearchResult[] = [],
): Promise<SearchResult[]> {
  if (depth <= 0) return results;
  const fullDir = relPath ? resolveSafe(workspacePath, relPath) : workspacePath;
  const entries = await fs.readdir(fullDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const childRel = path.posix.join(relPath, entry.name);
    const fullPath = path.join(fullDir, entry.name);

    if (entry.isDirectory()) {
      await searchDir(workspacePath, matcher, depth - 1, childRel, results);
      if (results.length >= 200) break;
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(fullPath);
    if (stat.size > MAX_FILE_SIZE) continue;

    const buf = await fs.readFile(fullPath);
    if (!isProbablyText(entry.name, buf)) continue;

    const content = buf.toString('utf-8');
    const lines = content.split(/\r?\n/);
    const matches: SearchMatch[] = [];

    outer: for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      matcher.lastIndex = 0;
      let exec: RegExpExecArray | null;
      while ((exec = matcher.exec(line)) !== null) {
        const length = exec[0].length;
        if (length === 0) {
          matcher.lastIndex += 1;
          continue;
        }
        const column = exec.index;
        const { preview, previewOffset } = makePreview(line, column);
        matches.push({
          line: index + 1,
          column: column + 1,
          length,
          preview,
          previewOffset,
        });
        if (matches.length >= 100) break outer;
      }
    }

    if (matches.length > 0) {
      results.push({ path: childRel, matches });
      if (results.length >= 200) break;
    }
  }

  return results;
}

const MAX_DTS_FILE_SIZE = 500 * 1024;
const MAX_EDITOR_PROJECT_FILES = 300;
const MAX_EDITOR_PROJECT_FILE_SIZE = 256 * 1024;

async function collectEditorProjectFilesInDir(
  workspacePath: string,
  depth: number,
  relPath = '',
  out: EditorProjectFile[] = [],
): Promise<EditorProjectFile[]> {
  if (depth <= 0 || out.length >= MAX_EDITOR_PROJECT_FILES) return out;
  const fullDir = relPath ? resolveSafe(workspacePath, relPath) : workspacePath;
  const entries = await fs.readdir(fullDir, { withFileTypes: true }).catch(() => null);
  if (!entries) return out;

  for (const entry of entries) {
    if (out.length >= MAX_EDITOR_PROJECT_FILES) break;
    if (IGNORED.has(entry.name)) continue;

    const childRel = path.posix.join(relPath, entry.name);
    const fullPath = path.join(fullDir, entry.name);

    if (entry.isDirectory()) {
      await collectEditorProjectFilesInDir(workspacePath, depth - 1, childRel, out);
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || stat.size > MAX_EDITOR_PROJECT_FILE_SIZE) continue;

    const buf = await fs.readFile(fullPath).catch(() => null);
    if (!buf || !isProbablyText(entry.name, buf)) continue;

    out.push({
      path: childRel,
      content: buf.toString('utf-8'),
    });
  }

  return out;
}

async function walkDts(
  dir: string,
  virtualBase: string,
  out: { virtualPath: string; content: string }[],
  visited = new Set<string>(),
): Promise<void> {
  if (visited.has(dir) || out.length >= 1000) return;
  visited.add(dir);

  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return;

  for (const entry of entries) {
    if (out.length >= 1000) break;
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    const virtualPath = `${virtualBase}/${entry.name}`;

    if (entry.isDirectory()) {
      await walkDts(fullPath, virtualPath, out, visited);
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      const stat = await fs.stat(fullPath).catch(() => null);
      if (!stat || stat.size > MAX_DTS_FILE_SIZE) continue;
      const content = await fs.readFile(fullPath, 'utf-8').catch(() => null);
      if (content !== null) out.push({ virtualPath, content });
    }
  }
}

export async function collectTypeDefs(workspacePath: string): Promise<{ virtualPath: string; content: string }[]> {
  const results: { virtualPath: string; content: string }[] = [];
  const declaredModules = new Set<string>();

  async function readPackageJson(pkgDir: string): Promise<PackageJsonLike | null> {
    try {
      return JSON.parse(await fs.readFile(path.join(pkgDir, 'package.json'), 'utf-8')) as PackageJsonLike;
    } catch {
      return null;
    }
  }

  function addFallbackModuleDeclaration(moduleName: string) {
    if (declaredModules.has(moduleName)) return;
    declaredModules.add(moduleName);
    results.push({
      virtualPath: `__generated__/${moduleName.replace(/[^a-z0-9/_-]+/gi, '_')}.d.ts`,
      content: `declare module '${moduleName}' { const value: any; export = value; }\ndeclare module '${moduleName}/*' { const value: any; export = value; }\n`,
    });
  }

  const rootPackageJson = await readPackageJson(workspacePath);
  const workspacePatterns = Array.isArray(rootPackageJson?.workspaces)
    ? rootPackageJson.workspaces
    : Array.isArray(rootPackageJson?.workspaces?.packages)
      ? rootPackageJson.workspaces.packages
      : [];

  const packageRoots: string[] = [];
  for (const pattern of workspacePatterns) {
    if (pattern.includes('*')) continue;
    packageRoots.push(path.join(workspacePath, pattern));
  }
  packageRoots.push(workspacePath);

  for (const packageRoot of packageRoots) {
    const pkgJson = await readPackageJson(packageRoot);
    if (!pkgJson) continue;
    const packageRelRoot = path.relative(workspacePath, packageRoot).split(path.sep).join('/');
    const packagePrefix = packageRelRoot ? `${packageRelRoot}/` : '';
    const nodeModulesPath = path.join(packageRoot, 'node_modules');

    const atTypesEntries = await fs.readdir(path.join(nodeModulesPath, '@types'), { withFileTypes: true }).catch(() => null);
    if (atTypesEntries) {
      for (const pkg of atTypesEntries) {
        if (results.length >= MAX_TYPEDEF_FILES) break;
        if (!pkg.isDirectory()) continue;
        await walkDts(
          path.join(nodeModulesPath, '@types', pkg.name),
          `${packagePrefix}node_modules/@types/${pkg.name}`,
          results,
        );
      }
    }

    const allDeps = [...Object.keys(pkgJson.dependencies ?? {}), ...Object.keys(pkgJson.devDependencies ?? {})];

    for (const dep of allDeps) {
      if (results.length >= MAX_TYPEDEF_FILES) break;
      const depDir = path.join(nodeModulesPath, dep);
      const depPkg = await readPackageJson(depDir);
      if (depPkg?.types || depPkg?.typings) {
        await walkDts(depDir, `${packagePrefix}node_modules/${dep}`, results);
        continue;
      }
      addFallbackModuleDeclaration(dep);
    }
  }

  return results;
}

export async function collectEditorProjectFiles(workspacePath: string): Promise<EditorProjectFile[]> {
  return collectEditorProjectFilesInDir(workspacePath, MAX_DEPTH);
}

export async function searchFiles(
  workspacePath: string,
  rawQuery: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];
  let matcher: RegExp;
  try {
    matcher = buildMatcher(query, options);
  } catch {
    return [];
  }
  return searchDir(workspacePath, matcher, MAX_DEPTH);
}
