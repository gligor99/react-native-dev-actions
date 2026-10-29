import { LOG_PREFIX } from './notify';
import type { StorageAdapter } from './types';

type Stored = string | null | undefined;

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | undefined)?.then === 'function';
}

/**
 * Reads `key` and passes the value to `apply`. With a sync adapter `apply`
 * runs before this returns, so state is ready before the first render.
 * Read errors are logged and treated as "nothing stored".
 */
export function readStored(
  storage: StorageAdapter,
  key: string,
  apply: (value: Stored) => void
): Promise<void> {
  const fail = (error: unknown) => {
    console.warn(`${LOG_PREFIX} Failed to read "${key}"`, error);
    return null;
  };

  let stored: ReturnType<StorageAdapter['get']>;
  try {
    stored = storage.get(key);
  } catch (error) {
    stored = fail(error);
  }

  if (isThenable<Stored>(stored)) {
    return Promise.resolve(stored).catch(fail).then(apply);
  }
  apply(stored);
  return Promise.resolve();
}
