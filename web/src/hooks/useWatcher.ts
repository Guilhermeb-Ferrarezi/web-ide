import { useEffect, useRef } from 'react';
import { buildWorkspaceWsUrl } from '@/lib/ws';

export type WatcherEvent =
  | { kind: 'fs'; event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'; path: string }
  | { kind: 'git'; path: string }
  | { kind: 'ready' };

export function useWatcher(workspace: string | null, onEvent: (e: WatcherEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!workspace) return;

    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(
        buildWorkspaceWsUrl({
          apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
          wsBaseUrl: import.meta.env.VITE_WS_BASE_URL,
          endpoint: 'watcher',
          workspace,
        }),
      );
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(typeof e.data === 'string' ? e.data : '');
          if (data && (data.kind === 'fs' || data.kind === 'git' || data.kind === 'ready')) {
            handlerRef.current(data as WatcherEvent);
            return;
          }
          if (data?.type === 'error') {
            console.error('[watcher] websocket error', data.message);
          }
        } catch {
          // ignore non-JSON
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        retryTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try { ws?.close(); } catch { /* ignore */ }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      try { ws?.close(); } catch { /* ignore */ }
    };
  }, [workspace]);
}
