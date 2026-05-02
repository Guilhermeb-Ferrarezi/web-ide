import { describe, expect, it, mock } from 'bun:test';
import { getOrCreateTerminalSession } from './terminal.sessions.ts';
import type { PtyHandle } from './terminal.service.ts';
import type { TerminalRole } from './terminal.service.ts';

type FakePty = PtyHandle['pty'] & {
  emitData: (data: string) => void;
  emitExit: (info?: { exitCode: number; signal: number }) => void;
};

function createFakePty() {
  const dataHandlers: Array<(data: string) => void> = [];
  const exitHandlers: Array<(info: { exitCode: number; signal: number }) => void> = [];
  const kill = mock(() => {
    for (const handler of exitHandlers) handler({ exitCode: 0, signal: 1 });
  });
  const pty = {
    pid: 1234,
    cols: 80,
    rows: 24,
    onData(handler: (data: string) => void) {
      dataHandlers.push(handler);
      return { dispose: mock(() => {}) } as any;
    },
    onExit(handler: (info: { exitCode: number; signal: number }) => void) {
      exitHandlers.push(handler);
      return { dispose: mock(() => {}) } as any;
    },
    write: mock(() => {}),
    resize: mock(() => {}),
    kill,
    emitData(data: string) {
      for (const handler of dataHandlers) handler(data);
    },
    emitExit(info: { exitCode: number; signal: number } = { exitCode: 0, signal: 1 }) {
      for (const handler of exitHandlers) handler(info);
    },
  } as unknown as FakePty;

  const handle: PtyHandle = {
    pty,
    kill,
  };

  return { pty, handle, kill };
}

function createFakeTimerEnv() {
  const timers: Array<() => void> = [];
  const setTimeoutFn = ((cb: () => void) => {
    timers.push(cb);
    return timers.length;
  }) as unknown as typeof setTimeout;
  const clearTimeoutFn = ((timer: number) => {
    const index = timer - 1;
    if (index >= 0 && index < timers.length) timers[index] = () => {};
  }) as unknown as typeof clearTimeout;
  return { timers, setTimeoutFn, clearTimeoutFn };
}

describe('terminal session reuse', () => {
  it('reusa a mesma sessao para reconnects do mesmo usuario e workspace', () => {
    const { handle, pty } = createFakePty();
    const timers = createFakeTimerEnv();
    const createPty = mock(() => handle);
    const session = getOrCreateTerminalSession('user-1', 'repo', '/workspace/repo', 'user' as TerminalRole, {
      createPty,
      killDelayMs: 1000,
      setTimeout: timers.setTimeoutFn,
      clearTimeout: timers.clearTimeoutFn,
    });

    const firstSocket = {
      send: mock(() => {}),
      close: mock(() => {}),
    };
    const secondSocket = {
      send: mock(() => {}),
      close: mock(() => {}),
    };

    session.attachSocket(firstSocket);
    pty.emitData('hello');
    expect(firstSocket.send).toHaveBeenCalledWith('hello');

    const sameSession = getOrCreateTerminalSession('user-1', 'repo', '/workspace/repo', 'user' as TerminalRole, {
      createPty,
      killDelayMs: 1000,
      setTimeout: timers.setTimeoutFn,
      clearTimeout: timers.clearTimeoutFn,
    });

    sameSession.attachSocket(secondSocket);
    pty.emitData('world');

    expect(createPty).toHaveBeenCalledTimes(1);
    expect(secondSocket.send).toHaveBeenCalledWith('world');
    expect(firstSocket.send).toHaveBeenCalledTimes(1);
    expect(firstSocket.close).not.toHaveBeenCalled();
  });

  it('adia o kill apos o close do socket para permitir reconnect', () => {
    const { handle } = createFakePty();
    const timers = createFakeTimerEnv();
    const createPty = mock(() => handle);
    const session = getOrCreateTerminalSession('user-2', 'repo', '/workspace/repo', 'user' as TerminalRole, {
      createPty,
      killDelayMs: 1000,
      setTimeout: timers.setTimeoutFn,
      clearTimeout: timers.clearTimeoutFn,
    });

    const socket = {
      send: mock(() => {}),
      close: mock(() => {}),
    };

    session.attachSocket(socket);
    session.detachSocket(socket);

    expect(handle.kill).not.toHaveBeenCalled();
    expect(timers.timers).toHaveLength(1);

    timers.timers[0]?.();
    expect(handle.kill).toHaveBeenCalledTimes(1);
  });
});
