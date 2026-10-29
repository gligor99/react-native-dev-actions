import type { StorageAdapter } from './types';

type MMKVLike = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  clearAll(): void;
};

type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
};

/** Sync adapter: env is known at startup, no `init()` needed. */
export function mmkvAdapter(mmkv: MMKVLike): StorageAdapter {
  return {
    get: (key) => mmkv.getString(key),
    set: (key, value) => mmkv.set(key, value),
    clear: () => mmkv.clearAll(),
  };
}

/** Async adapter: call `await env.init()` or wrap the app in `<EnvGate>`. */
export function asyncStorageAdapter(storage: AsyncStorageLike): StorageAdapter {
  return {
    get: (key) => storage.getItem(key),
    set: (key, value) => storage.setItem(key, value),
    clear: () => storage.clear(),
  };
}
