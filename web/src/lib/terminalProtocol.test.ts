import { describe, expect, it } from 'bun:test';
import { parseTerminalSocketPayload } from './terminalProtocol';

describe('parseTerminalSocketPayload', () => {
  it('returns plain terminal text unchanged', () => {
    expect(parseTerminalSocketPayload('hello')).toEqual({
      text: 'hello',
      control: null,
    });
  });

  it('extracts keepalive control messages', () => {
    expect(parseTerminalSocketPayload(JSON.stringify({ type: 'pong' }))).toEqual({
      text: null,
      control: { type: 'pong' },
    });
  });

  it('extracts websocket error messages', () => {
    expect(parseTerminalSocketPayload(JSON.stringify({ type: 'error', message: 'permission_denied' }))).toEqual({
      text: null,
      control: { type: 'error', message: 'permission_denied' },
    });
  });

  it('keeps json-looking terminal output visible when it is not a control message', () => {
    expect(parseTerminalSocketPayload('{"ok":true}')).toEqual({
      text: '{"ok":true}',
      control: null,
    });
  });
});
