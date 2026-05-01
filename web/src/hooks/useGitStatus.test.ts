import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGitStatus } from './useGitStatus';
import * as gitApi from '@/api/git';
import { watcherBus } from '@/lib/watcherBus';
import type { GitStatus } from '@/types';

vi.mock('@/api/git');

const sampleStatus: GitStatus = {
  branch: 'main',
  ahead: 0,
  behind: 0,
  staged: [],
  unstaged: [],
  untracked: [],
};

describe('useGitStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('busca status no mount', async () => {
    vi.useRealTimers();
    vi.spyOn(gitApi, 'fetchStatus').mockResolvedValue(sampleStatus);
    const { result } = renderHook(() => useGitStatus('repo'));
    await waitFor(() => expect(result.current.status?.branch).toBe('main'));
  });

  it('zera status em caso de erro', async () => {
    vi.useRealTimers();
    vi.spyOn(gitApi, 'fetchStatus').mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useGitStatus('repo'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBeNull();
  });

  it('refaz busca quando recebe evento do watcher (debounced)', async () => {
    vi.useRealTimers();
    const spy = vi.spyOn(gitApi, 'fetchStatus').mockResolvedValue(sampleStatus);
    renderHook(() => useGitStatus('repo'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    act(() => {
      watcherBus.emit({ kind: 'git', path: '.git/HEAD' });
      watcherBus.emit({ kind: 'git', path: '.git/index' });
    });
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2), { timeout: 1000 });
  });

  it('não dispara para eventos kind=ready', async () => {
    vi.useRealTimers();
    const spy = vi.spyOn(gitApi, 'fetchStatus').mockResolvedValue(sampleStatus);
    renderHook(() => useGitStatus('repo'));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    act(() => {
      watcherBus.emit({ kind: 'ready' } as any);
    });
    await new Promise((r) => setTimeout(r, 350));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
