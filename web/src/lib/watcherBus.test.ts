import { describe, it, expect, vi } from 'vitest';
import { watcherBus } from './watcherBus';

describe('watcherBus', () => {
  it('chama listeners inscritos', () => {
    const fn = vi.fn();
    const off = watcherBus.subscribe(fn);
    watcherBus.emit({ kind: 'fs', event: 'change', path: 'a.txt' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith({ kind: 'fs', event: 'change', path: 'a.txt' });
    off();
  });

  it('para de chamar após unsubscribe', () => {
    const fn = vi.fn();
    const off = watcherBus.subscribe(fn);
    off();
    watcherBus.emit({ kind: 'git', path: '.git/HEAD' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('isola erros de um listener dos demais', () => {
    const a = vi.fn(() => { throw new Error('boom'); });
    const b = vi.fn();
    const offA = watcherBus.subscribe(a);
    const offB = watcherBus.subscribe(b);
    expect(() => watcherBus.emit({ kind: 'ready' })).not.toThrow();
    expect(b).toHaveBeenCalled();
    offA();
    offB();
  });
});
