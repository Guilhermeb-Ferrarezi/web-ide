import { describe, expect, it } from 'vitest';
import { buildWorkspaceWsUrl } from './ws';

const location = {
  protocol: 'http:',
  host: 'localhost:5173',
} satisfies Pick<Location, 'protocol' | 'host'>;

describe('buildWorkspaceWsUrl', () => {
  it('uses the current origin for relative api paths', () => {
    expect(
      buildWorkspaceWsUrl({
        apiBaseUrl: '/api',
        endpoint: 'terminal',
        workspace: 'repo',
        location,
        dev: true,
      }),
    ).toBe('ws://localhost:5173/api/terminal?workspace=repo');
  });

  it('keeps same-host absolute api urls', () => {
    expect(
      buildWorkspaceWsUrl({
        apiBaseUrl: 'http://localhost:5173/api',
        endpoint: 'watcher',
        workspace: 'repo',
        location,
        dev: true,
      }),
    ).toBe('ws://localhost:5173/api/watcher?workspace=repo');
  });

  it('routes cross-origin dev websocket traffic through the current origin proxy', () => {
    expect(
      buildWorkspaceWsUrl({
        apiBaseUrl: 'http://localhost:3000/api',
        endpoint: 'terminal',
        workspace: 'repo name',
        location,
        dev: true,
      }),
    ).toBe('ws://localhost:5173/api/terminal?workspace=repo%20name');
  });

  it('uses the configured origin outside development', () => {
    expect(
      buildWorkspaceWsUrl({
        apiBaseUrl: 'https://api.example.com/api',
        endpoint: 'watcher',
        workspace: 'repo',
        location,
        dev: false,
      }),
    ).toBe('wss://api.example.com/api/watcher?workspace=repo');
  });

  it('honors an explicit websocket base url in development', () => {
    expect(
      buildWorkspaceWsUrl({
        apiBaseUrl: 'http://localhost:3000/api',
        wsBaseUrl: 'http://localhost:3000/api',
        endpoint: 'terminal',
        workspace: 'repo',
        location,
        dev: true,
      }),
    ).toBe('ws://localhost:3000/api/terminal?workspace=repo');
  });
});
