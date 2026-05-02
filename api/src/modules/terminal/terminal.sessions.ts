import type { IPty } from 'node-pty';
import type { TerminalRole, PtyHandle } from './terminal.service.ts';

export type TerminalSocketLike = Pick<WebSocket, 'send' | 'close'>;

export type TerminalSessionHandle = {
  pty: IPty;
  kill: () => void;
};

export type TerminalSession = {
  handle: TerminalSessionHandle;
  socket: TerminalSocketLike | null;
  attachSocket: (socket: TerminalSocketLike) => void;
  detachSocket: (socket: TerminalSocketLike) => void;
  dispose: () => void;
};

type TerminalSessionEntry = {
  handle: PtyHandle;
  socket: TerminalSocketLike | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
};

type CreateTerminalSessionOptions = {
  createPty: (cwd: string, role: TerminalRole) => PtyHandle;
  killDelayMs?: number;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
  onExit?: (info: { exitCode: number; signal?: number }) => void;
};

const DEFAULT_KILL_DELAY_MS = 15_000;

const sessions = new Map<string, TerminalSessionEntry>();

function sessionKey(userId: string, workspace: string) {
  return `${userId}:${workspace}`;
}

function clearCleanupTimer(entry: TerminalSessionEntry, clearTimeoutFn: typeof globalThis.clearTimeout) {
  if (entry.cleanupTimer === null) return;
  clearTimeoutFn(entry.cleanupTimer);
  entry.cleanupTimer = null;
}

export function getOrCreateTerminalSession(
  userId: string,
  workspace: string,
  cwd: string,
  role: TerminalRole,
  options: CreateTerminalSessionOptions,
): TerminalSession {
  const key = sessionKey(userId, workspace);
  const setTimeoutFn = options.setTimeout ?? globalThis.setTimeout;
  const clearTimeoutFn = options.clearTimeout ?? globalThis.clearTimeout;
  const killDelayMs = options.killDelayMs ?? DEFAULT_KILL_DELAY_MS;

  let entry = sessions.get(key);
  if (!entry) {
    const handle = options.createPty(cwd, role);
    entry = {
      handle,
      socket: null,
      cleanupTimer: null,
    };

    handle.pty.onData((data) => {
      const socket = entry?.socket;
      if (!socket) return;
      try {
        socket.send(data);
      } catch {
        // ignore send failures while the client reconnects
      }
    });

    handle.pty.onExit((info) => {
      options.onExit?.(info);
      clearCleanupTimer(entry!, clearTimeoutFn);
      sessions.delete(key);
      try {
        entry?.socket?.close();
      } catch {
        // ignore
      }
    });

    sessions.set(key, entry);
  }

  clearCleanupTimer(entry, clearTimeoutFn);

  return {
    handle: entry.handle,
    get socket() {
      return entry?.socket ?? null;
    },
    attachSocket(socket: TerminalSocketLike) {
      clearCleanupTimer(entry!, clearTimeoutFn);
      entry!.socket = socket;
    },
    detachSocket(socket: TerminalSocketLike) {
      if (entry?.socket !== socket) return;
      entry.socket = null;
      clearCleanupTimer(entry, clearTimeoutFn);
      entry.cleanupTimer = setTimeoutFn(() => {
        if (entry?.socket !== null) return;
        try {
          entry?.handle.kill();
        } catch {
          // ignore
        }
      }, killDelayMs);
    },
    dispose() {
      clearCleanupTimer(entry!, clearTimeoutFn);
      sessions.delete(key);
      try {
        entry?.handle.kill();
      } catch {
        // ignore
      }
    },
  };
}
