import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node-pty';

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'restricted-shell.sh');
const tempDirs: string[] = [];

function makeWorkspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'restricted-shell-'));
  tempDirs.push(dir);
  return dir;
}

function runRestrictedShell(input: string, workspace = makeWorkspace()) {
  return spawnSync('/bin/bash', ['--noprofile', '--norc', scriptPath], {
    cwd: workspace,
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: workspace,
      PATH: '/usr/bin:/bin',
    },
  });
}

async function runRestrictedShellPty(
  workspace: string,
  interactions: Array<{ input: string; waitFor: string }>,
) {
  return await new Promise<string>((resolve, reject) => {
    const pty = spawn('/bin/bash', ['--noprofile', '--norc', '-i', scriptPath], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: workspace,
      env: {
        ...process.env,
        HOME: workspace,
        PATH: '/usr/bin:/bin',
        TERM: 'xterm-256color',
      },
    });

    let output = '';
    let step = 0;
    let settled = false;

    const timeout = setTimeout(() => {
      settled = true;
      pty.kill();
      reject(new Error(`Timed out waiting for output. Current output:\n${output}`));
    }, 5000);

    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      pty.kill();
      resolve(value);
    };

    pty.onData((data) => {
      output += data;
      if (step >= interactions.length) {
        finish(output);
        return;
      }

      const current = interactions[step];
      if (output.includes(current.waitFor)) {
        pty.write(current.input);
        step += 1;
      }
    });

    pty.onExit(() => {
      if (!settled) {
        clearTimeout(timeout);
        resolve(output);
      }
    });
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('restricted-shell', () => {
  it('shows terminal shortcuts helper', () => {
    const result = runRestrictedShell('shortcuts\n');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Ctrl+Shift+C');
    expect(result.stdout).toContain('Ctrl+Shift+V');
  });

  it('blocks unsafe git subcommands for restricted users', () => {
    const result = runRestrictedShell('git push origin main\n');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[terminal] blocked git subcommand: push');
  });

  it('allows cd .. while staying inside the workspace', () => {
    const workspace = makeWorkspace();
    fs.mkdirSync(path.join(workspace, 'nested'));

    const result = runRestrictedShell('cd nested\npwd\ncd ..\npwd\n', workspace);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`${workspace}/nested`);
    expect(result.stdout).toContain(`${workspace}\n`);
  });

  it('blocks cd .. from escaping the workspace root', () => {
    const workspace = makeWorkspace();

    const result = runRestrictedShell('cd ..\npwd\n', workspace);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[terminal] blocked path outside workspace: ..');
    expect(result.stdout).toContain(`${workspace}\n`);
    expect(result.stdout).not.toContain(`${path.dirname(workspace)}\n`);
  });

  it('recalls the previous command with arrow up', async () => {
    const workspace = makeWorkspace();

    const output = await runRestrictedShellPty(workspace, [
      { waitFor: 'web-ide:~$ ', input: 'pwd\r' },
      { waitFor: workspace, input: '\u001b[A\r' },
      { waitFor: `${workspace}\nweb-ide:~$ pwd`, input: '\u0004' },
    ]);

    const normalized = output.replaceAll('\r', '');
    const occurrences = normalized.split(`${workspace}\n`).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
