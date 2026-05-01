import type { WatcherEvent } from '@/hooks/useWatcher';

type Listener = (e: WatcherEvent) => void;

const listeners = new Set<Listener>();

export const watcherBus = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  emit(e: WatcherEvent) {
    for (const fn of listeners) {
      try {
        fn(e);
      } catch {
        // ignore
      }
    }
  },
};
