import { useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { buildWorkspaceWsUrl } from '@/lib/ws';
import { parseTerminalSocketPayload, TERMINAL_KEEPALIVE_INTERVAL_MS } from '@/lib/terminalProtocol';

function safeFit(fit: FitAddon, container: HTMLElement): boolean {
  if (container.clientWidth === 0 || container.clientHeight === 0) return false;
  try {
    const proposed = fit.proposeDimensions();
    if (!proposed || !proposed.cols || !proposed.rows) return false;
    fit.fit();
    return true;
  } catch {
    return false;
  }
}

export function useTerminal(containerRef: React.RefObject<HTMLDivElement>, workspace: string) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let term: Terminal | null = null;
    let fit: FitAddon | null = null;
    let ws: WebSocket | null = null;
    let ro: ResizeObserver | null = null;
    let rafId: number | null = null;
    let keepaliveId: number | null = null;

    const term_ = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, Menlo, Monaco, "Courier New", monospace',
      theme: { background: '#0a0a0a' },
      cursorBlink: true,
      convertEol: true,
    });
    const fit_ = new FitAddon();
    term_.loadAddon(fit_);
    term_.loadAddon(new WebLinksAddon());
    term_.open(container);
    term = term_;
    fit = fit_;

    const tryFit = () => {
      if (disposed || !term || !fit) return;
      if (!safeFit(fit, container)) {
        rafId = requestAnimationFrame(tryFit);
        return;
      }
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    };

    rafId = requestAnimationFrame(tryFit);

    ws = new WebSocket(
      buildWorkspaceWsUrl({
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
        wsBaseUrl: import.meta.env.VITE_WS_BASE_URL,
        endpoint: 'terminal',
        workspace,
      }),
    );
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      if (disposed || !term) return;
      ws!.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      keepaliveId = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, TERMINAL_KEEPALIVE_INTERVAL_MS);
    };
    ws.onmessage = (e) => {
      if (disposed || !term) return;
      const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
      const { text, control } = parseTerminalSocketPayload(data);
      if (control?.type === 'error') {
        console.error('[terminal] websocket error', control.message);
        return;
      }
      if (control) return;
      if (text !== null) term.write(text);
    };
    ws.onclose = () => {
      if (disposed || !term) return;
      if (keepaliveId !== null) window.clearInterval(keepaliveId);
      term.write('\r\n[conexão encerrada]\r\n');
    };
    ws.onerror = () => {
      if (disposed || !term) return;
      term.write('\r\n[erro de conexão]\r\n');
    };

    const dataDispose = term.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(data);
    });

    ro = new ResizeObserver(() => {
      if (disposed || !term || !fit) return;
      if (safeFit(fit, container) && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }
    });
    ro.observe(container);

    return () => {
      disposed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (keepaliveId !== null) window.clearInterval(keepaliveId);
      dataDispose.dispose();
      ro?.disconnect();
      try { ws?.close(); } catch { /* ignore */ }
      try { term?.dispose(); } catch { /* ignore */ }
      term = null;
      fit = null;
      ws = null;
      ro = null;
    };
  }, [containerRef, workspace]);
}
