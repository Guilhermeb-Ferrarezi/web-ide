import { describe, expect, it } from 'bun:test';
import { resolveTerminalAccess, type TerminalRole } from './terminal.service.ts';

describe('resolveTerminalAccess', () => {
  it('uses restricted shell for regular users', () => {
    const access = resolveTerminalAccess('/workspace/demo', 'user', {
      restrictedShellPath: '/tmp/restricted-shell.sh',
    });

    expect(access.restricted).toBe(true);
    expect(access.shell).toBe('/bin/bash');
    expect(access.args).toEqual([
      '--noprofile',
      '--norc',
      '-i',
      '/tmp/restricted-shell.sh',
    ]);
    expect(access.env.PATH).toBe('/usr/local/bin:/usr/bin:/bin');
    expect(access.env.TERM).toBe('xterm-256color');
    expect(access.env.HOME).toBe('/workspace/demo');
  });

  it('allows unrestricted shell for terminal_superuser', () => {
    const access = resolveTerminalAccess('/workspace/demo', 'terminal_superuser', {
      shell: '/bin/bash',
    });

    expect(access.restricted).toBe(false);
    expect(access.shell).toBe('/bin/bash');
    expect(access.args).toEqual([]);
    expect(access.env.TERM).toBe('xterm-256color');
  });

  it('treats owner and admin as restricted by default', () => {
    const ownerAccess = resolveTerminalAccess('/workspace/demo', 'owner');
    const adminAccess = resolveTerminalAccess('/workspace/demo', 'admin');

    expect(ownerAccess.restricted).toBe(true);
    expect(adminAccess.restricted).toBe(true);
  });

  it('supports custom shell for unrestricted role', () => {
    const access = resolveTerminalAccess('/workspace/demo', 'terminal_superuser', {
      shell: '/usr/bin/zsh',
    });

    expect(access.shell).toBe('/usr/bin/zsh');
    expect(access.args).toEqual([]);
  });

  it('forces bash wrapper for restricted role even when custom shell is configured', () => {
    const access = resolveTerminalAccess('/workspace/demo', 'user', {
      shell: '/usr/bin/zsh',
      restrictedShellPath: '/tmp/restricted-shell.sh',
    });

    expect(access.shell).toBe('/bin/bash');
    expect(access.args).toEqual([
      '--noprofile',
      '--norc',
      '-i',
      '/tmp/restricted-shell.sh',
    ]);
  });
});

describe('TerminalRole type coverage', () => {
  it('accepts the privileged role literal', () => {
    const role: TerminalRole = 'terminal_superuser';
    expect(role).toBe('terminal_superuser');
  });
});
