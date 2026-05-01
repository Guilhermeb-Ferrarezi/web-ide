import { spawn, type IPty } from 'node-pty';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppRole } from '../users/users.service.ts';

export type PtyHandle = {
  pty: IPty;
  kill: () => void;
};

export type TerminalRole = AppRole;

export type TerminalAccess = {
  restricted: boolean;
  shell: string;
  args: string[];
  env: Record<string, string>;
};

const DEFAULT_PATH = '/usr/local/bin:/usr/bin:/bin';

export function resolveTerminalAccess(
  cwd: string,
  role: TerminalRole,
  options?: {
    shell?: string;
    restrictedShellPath?: string;
  },
): TerminalAccess {
  const configuredShell = options?.shell ?? process.env.SHELL ?? (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
  const restricted = role !== 'terminal_superuser';
  const restrictedShellPath =
    options?.restrictedShellPath ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'restricted-shell.sh');
  const shell = restricted ? '/bin/bash' : configuredShell;

  return {
    restricted,
    shell,
    args: restricted ? ['--noprofile', '--norc', '-i', restrictedShellPath] : [],
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PATH: DEFAULT_PATH,
      HOME: cwd,
      SHELL: shell,
      TERMINAL_ACCESS_MODE: restricted ? 'restricted' : 'unrestricted',
    },
  };
}

export function createPty(cwd: string, role: TerminalRole): PtyHandle {
  const access = resolveTerminalAccess(cwd, role);
  const pty = spawn(access.shell, access.args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: access.env,
  });
  return {
    pty,
    kill: () => {
      try {
        pty.kill();
      } catch {
        // ignore
      }
    },
  };
}
