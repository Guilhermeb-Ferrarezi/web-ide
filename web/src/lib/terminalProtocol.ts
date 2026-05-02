export const TERMINAL_KEEPALIVE_INTERVAL_MS = 5_000;

type TerminalControlMessage =
  | { type: 'error'; message?: string }
  | { type: 'ping' | 'pong' };

export function parseTerminalSocketPayload(payload: string): { text: string | null; control: TerminalControlMessage | null } {
  if (!payload.startsWith('{')) {
    return { text: payload, control: null };
  }

  try {
    const parsed = JSON.parse(payload) as { type?: string; message?: string };
    if (parsed.type === 'error') {
      return { text: null, control: { type: 'error', message: parsed.message } };
    }
    if (parsed.type === 'ping' || parsed.type === 'pong') {
      return { text: null, control: { type: parsed.type } };
    }
  } catch {
    // Fall through and render raw text
  }

  return { text: payload, control: null };
}
