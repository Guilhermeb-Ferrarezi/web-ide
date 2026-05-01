import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';

export type WatcherEvent =
  | { kind: 'fs'; event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'; path: string }
  | { kind: 'git'; path: string };

type Listener = (event: WatcherEvent) => void;

type Pool = {
  watcher: FSWatcher;
  listeners: Set<Listener>;
};

const pools = new Map<string, Pool>();

const IGNORED = [
  /(^|[\\/])\.DS_Store$/,
  /(^|[\\/])node_modules([\\/]|$)/,
  /(^|[\\/])dist([\\/]|$)/,
  /(^|[\\/])build([\\/]|$)/,
  /(^|[\\/])\.next([\\/]|$)/,
];

function toRelative(root: string, abs: string): string {
  const rel = path.relative(root, abs);
  return rel.split(path.sep).join('/');
}

function isGitInternal(rel: string): boolean {
  return rel === '.git' || rel.startsWith('.git/');
}

function attach(workspacePath: string): Pool {
  const watcher = chokidar.watch(workspacePath, {
    ignored: IGNORED,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 30 },
  });

  const pool: Pool = { watcher, listeners: new Set() };

  const emit = (e: WatcherEvent) => {
    for (const fn of pool.listeners) {
      try {
        fn(e);
      } catch {
        // ignore listener errors
      }
    }
  };

  const onFs = (event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir') => (abs: string) => {
    const rel = toRelative(workspacePath, abs);
    if (!rel || rel.startsWith('..')) return;
    if (isGitInternal(rel)) {
      emit({ kind: 'git', path: rel });
      return;
    }
    emit({ kind: 'fs', event, path: rel });
  };

  watcher.on('add', onFs('add'));
  watcher.on('change', onFs('change'));
  watcher.on('unlink', onFs('unlink'));
  watcher.on('addDir', onFs('addDir'));
  watcher.on('unlinkDir', onFs('unlinkDir'));

  return pool;
}

export function subscribe(workspacePath: string, listener: Listener): () => void {
  let pool = pools.get(workspacePath);
  if (!pool) {
    pool = attach(workspacePath);
    pools.set(workspacePath, pool);
  }
  pool.listeners.add(listener);

  return () => {
    const current = pools.get(workspacePath);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size === 0) {
      pools.delete(workspacePath);
      void current.watcher.close();
    }
  };
}
