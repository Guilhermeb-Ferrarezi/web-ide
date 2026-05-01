export type TerminalClientMessage =
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'input'; data: string }
  | { type: 'ping' }
  | { type: 'raw'; data: string };

export function parseTerminalClientMessage(raw: string): TerminalClientMessage {
  if (!raw.startsWith('{')) {
    return { type: 'raw', data: raw };
  }

  try {
    const parsed = JSON.parse(raw) as { type?: string; cols?: number; rows?: number; data?: string };
    if (parsed.type === 'resize' && typeof parsed.cols === 'number' && typeof parsed.rows === 'number') {
      return { type: 'resize', cols: parsed.cols, rows: parsed.rows };
    }
    if (parsed.type === 'input' && typeof parsed.data === 'string') {
      return { type: 'input', data: parsed.data };
    }
    if (parsed.type === 'ping') {
      return { type: 'ping' };
    }
  } catch {
    // Fall through and treat as raw terminal input
  }

  return { type: 'raw', data: raw };
}
