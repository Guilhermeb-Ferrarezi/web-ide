import { useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { buildWorkspaceWsUrl } from '@/lib/ws';
import { createTerminalInputState, reduceTerminalInput } from '@/lib/terminalInput';
import { parseTerminalSocketPayload, TERMINAL_KEEPALIVE_INTERVAL_MS } from '@/lib/terminalProtocol';

const TERMINAL_RECONNECT_DELAY_MS = 1000;

type TerminalSelectionState = {
  anchorColumn: number;
  focusColumn: number;
  row: number;
} | null;

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
    let reconnectId: number | null = null;
    let inputState = createTerminalInputState();
    let hasConnected = false;
    let selectionState: TerminalSelectionState = null;

    const term_ = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, Menlo, Monaco, "Courier New", monospace',
      theme: { background: '#0a0a0a' },
      cursorBlink: true,
      convertEol: true,
    });

    async function copySelectedText() {
      const selection = term_.getSelection();
      if (!selection) return;

      try {
        await navigator.clipboard.writeText(selection);
      } catch {
        // ignore clipboard failures
      }
    }

    function updateHorizontalSelection(direction: -1 | 1) {
      const buffer = (term_ as any).buffer?.active;
      const cursorX = typeof buffer?.cursorX === 'number' ? buffer.cursorX : 0;
      const cursorY = typeof buffer?.cursorY === 'number' ? buffer.cursorY : 0;
      const baseY = typeof buffer?.baseY === 'number' ? buffer.baseY : 0;
      const row = baseY + cursorY;
      const maxColumn = Math.max(term_.cols, cursorX + 1);

      if (!selectionState || selectionState.row !== row) {
        selectionState = {
          anchorColumn: cursorX,
          focusColumn: Math.max(0, Math.min(maxColumn, cursorX + direction)),
          row,
        };
      } else {
        selectionState = {
          ...selectionState,
          focusColumn: Math.max(0, Math.min(maxColumn, selectionState.focusColumn + direction)),
        };
      }

      const startColumn = Math.min(selectionState.anchorColumn, selectionState.focusColumn);
      const length = Math.abs(selectionState.focusColumn - selectionState.anchorColumn);

      if (length === 0) {
        term_.clearSelection();
        return;
      }

      term_.select(startColumn, row, length);
    }

    term_.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true;

      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copySelectedText();
        return false;
      }

      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          updateHorizontalSelection(-1);
          return false;
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault();
          updateHorizontalSelection(1);
          return false;
        }
      }

      return true;
    });

    term_.onData(() => {
      selectionState = null;
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

    const clearKeepalive = () => {
      if (keepaliveId !== null) {
        window.clearInterval(keepaliveId);
        keepaliveId = null;
      }
    };

    const connect = () => {
      if (disposed) return;

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
        if (disposed || !term || !ws) return;
        if (hasConnected) {
          term.write('\r\n[reconectado]\r\n');
        } else {
          hasConnected = true;
        }
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        clearKeepalive();
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
        clearKeepalive();
        if (disposed || !term) return;
        term.write('\r\n[conexão encerrada; reconectando...]\r\n');
        reconnectId = window.setTimeout(connect, TERMINAL_RECONNECT_DELAY_MS);
      };
      ws.onerror = () => {
        if (disposed || !term) return;
        term.write('\r\n[erro de conexão]\r\n');
      };
    };

    connect();

    const dataDispose = term.onData((data) => {
      const result = reduceTerminalInput(inputState, data);
      inputState = result.nextState;
      if (result.outbound && ws?.readyState === WebSocket.OPEN) {
        ws.send(result.outbound);
      }
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
      clearKeepalive();
      if (reconnectId !== null) window.clearTimeout(reconnectId);
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
