import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

function buildWsUrl(workspace: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  if (base.startsWith('http')) {
    const u = new URL(base);
    return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}${u.pathname}/terminal?workspace=${encodeURIComponent(workspace)}`;
  }
  return `${protocol}//${window.location.host}${base}/terminal?workspace=${encodeURIComponent(workspace)}`;
}

export function useTerminal(containerRef: React.RefObject<HTMLDivElement>, workspace: string) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, Menlo, Monaco, "Courier New", monospace',
      theme: { background: '#0a0a0a' },
      cursorBlink: true,
      convertEol: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    const ws = new WebSocket(buildWsUrl(workspace));
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
      term.write(data);
    };
    ws.onclose = () => term.write('\r\n[conexão encerrada]\r\n');
    ws.onerror = () => term.write('\r\n[erro de conexão]\r\n');

    const dataDispose = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        // ignore
      }
    });
    ro.observe(containerRef.current);

    return () => {
      dataDispose.dispose();
      ro.disconnect();
      try { ws.close(); } catch { /* ignore */ }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      wsRef.current = null;
    };
  }, [containerRef, workspace]);
}
