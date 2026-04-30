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

const IGNORED = new Set(['.git', 'node_modules', '.DS_Store', '.next', 'dist', 'build']);
const MAX_DEPTH = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'md', 'mdx', 'txt', 'css', 'scss', 'sass', 'less',
  'html', 'htm', 'xml', 'svg', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerignore', 'sh',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp', 'sql', 'graphql', 'gql',
  'vue', 'svelte', 'astro', 'prisma', 'lock',
]);

function isProbablyText(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return TEXT_EXTENSIONS.has(filename.toLowerCase());
  return TEXT_EXTENSIONS.has(ext);
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
  if (isProbablyText(name)) {
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
