import { spawn, type IPty } from 'node-pty';
import os from 'node:os';

export type PtyHandle = {
  pty: IPty;
  kill: () => void;
};

export function createPty(cwd: string): PtyHandle {
  const shell = process.env.SHELL ?? (os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash');
  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
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
