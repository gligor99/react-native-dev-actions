import { Alert, DevSettings } from 'react-native';
import { DEFAULT_ENV_KEY } from './env';
import { notify } from './notify';
import type { DevActionHandler, StorageAdapter } from './types';

type EnvLike = {
  name(): string;
  get(): object;
};

/**
 * Clears the storage, keeping the selected env (and any other `keep` keys),
 * then reloads.
 */
export function clearStorage(
  storage: StorageAdapter,
  {
    keep = [DEFAULT_ENV_KEY],
    reload = true,
  }: { keep?: string[]; reload?: boolean } = {}
): DevActionHandler {
  return async () => {
    const kept = await Promise.all(
      keep.map(async (key) => [key, await storage.get(key)] as const)
    );
    await storage.clear();
    for (const [key, value] of kept) {
      if (value != null) await storage.set(key, value);
    }

    if (reload) {
      DevSettings.reload('Storage cleared');
    } else {
      notify('Storage cleared.');
    }
  };
}

/** Shows the current env name and its values. */
export function showEnvInfo(env: EnvLike): DevActionHandler {
  return () => {
    Alert.alert(`Env: ${env.name()}`, JSON.stringify(env.get(), null, 2));
  };
}

/**
 * Runs `reset` (wipe SQLite, offline cache, tokens...) and reloads, so the
 * app starts without stale in-memory state.
 */
export function resetAndReload(
  reset: () => unknown,
  reason = 'Reset'
): DevActionHandler {
  return async () => {
    await reset();
    DevSettings.reload(reason);
  };
}
