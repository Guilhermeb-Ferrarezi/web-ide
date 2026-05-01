import { describe, expect, it } from 'bun:test';
import { parseTerminalClientMessage } from './terminal.protocol';

describe('parseTerminalClientMessage', () => {
  it('parses resize payloads', () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }))).toEqual({
      type: 'resize',
      cols: 120,
      rows: 40,
    });
  });

  it('parses keepalive pings', () => {
    expect(parseTerminalClientMessage(JSON.stringify({ type: 'ping' }))).toEqual({
      type: 'ping',
    });
  });

  it('treats unknown json as raw input', () => {
    expect(parseTerminalClientMessage('{"ok":true}')).toEqual({
      type: 'raw',
      data: '{"ok":true}',
    });
  });

  it('treats plain terminal input as raw', () => {
    expect(parseTerminalClientMessage('ls -la')).toEqual({
      type: 'raw',
      data: 'ls -la',
    });
  });
});
