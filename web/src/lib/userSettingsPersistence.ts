type PersistFn<T> = (value: T) => Promise<void>;

const timers = new Map<string, number>();

export function queueUserSettingPersist<T>(key: string, value: T, persist: PersistFn<T>, delayMs = 180) {
  if (typeof window === 'undefined') return;
  const existing = timers.get(key);
  if (existing) window.clearTimeout(existing);

  const timer = window.setTimeout(() => {
    timers.delete(key);
    void persist(value).catch(() => {
      // ignore background persistence failures
    });
  }, delayMs);

  timers.set(key, timer);
}

export function resetUserSettingPersistQueue() {
  if (typeof window === 'undefined') return;
  for (const timer of timers.values()) {
    window.clearTimeout(timer);
  }
  timers.clear();
}
