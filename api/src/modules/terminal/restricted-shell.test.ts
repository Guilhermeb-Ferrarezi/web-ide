import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
      HOME: '/tmp/web-ide-terminal-home',
      TERMINAL_WORKSPACE_ROOT: workspace,
      PATH: '/usr/bin:/bin',
    },
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
});
