import { useSyncExternalStore, type ReactNode } from 'react';
import { DevSettings } from 'react-native';
import { LOG_PREFIX, notify } from './notify';
import { devActions } from './registry';
import type { StorageAdapter } from './types';

export const DEFAULT_ENV_KEY = '@react-native-dev-actions/env';

export type EnvOptions<E extends Record<string, object>> = {
  envs: E;
  /** Used on first launch, and always in release builds. */
  default: keyof E & string;
  storage: StorageAdapter;
  storageKey?: string;
  /** Runs before the app reloads into the new env. Wipe tokens, caches, local DBs here. */
  onBeforeSwitch?: (from: keyof E & string, to: keyof E & string) => unknown;
  /** Add an "Env → <name>" dev menu item per env. Defaults to `true`. */
  menu?: boolean;
};

function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return typeof (value as PromiseLike<T> | undefined)?.then === 'function';
}

export function createEnv<const E extends Record<string, object>>(
  options: EnvOptions<E>
) {
  type Name = keyof E & string;

  const storageKey = options.storageKey ?? DEFAULT_ENV_KEY;
  const listeners = new Set<() => void>();
  let current: Name = options.default;
  let ready = false;
  let initPromise: Promise<void> | undefined;
  let warnedEarlyRead = false;

  const isName = (value: unknown): value is Name =>
    typeof value === 'string' && Object.hasOwn(options.envs, value);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function finishInit(stored: string | null | undefined): void {
    if (isName(stored)) {
      current = stored;
    } else if (stored != null) {
      console.warn(
        `${LOG_PREFIX} Stored env "${stored}" is not defined, using "${options.default}".`
      );
    }
    ready = true;
    if (options.menu !== false) registerMenu();
    listeners.forEach((listener) => listener());
  }

  /** Reads the stored env. Safe to call many times. */
  function init(): Promise<void> {
    if (initPromise) return initPromise;

    // Release builds never read storage: a debug build installed over the
    // same bundle id must not leak its env into release.
    if (!__DEV__) {
      ready = true;
      initPromise = Promise.resolve();
      return initPromise;
    }

    let stored: ReturnType<StorageAdapter['get']>;
    try {
      stored = options.storage.get(storageKey);
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to read stored env`, error);
      stored = null;
    }

    if (isThenable<string | null | undefined>(stored)) {
      initPromise = Promise.resolve(stored)
        .catch((error: unknown) => {
          console.warn(`${LOG_PREFIX} Failed to read stored env`, error);
          return null;
        })
        .then(finishInit);
    } else {
      finishInit(stored);
      initPromise = Promise.resolve();
    }
    return initPromise;
  }

  function name(): Name {
    if (!ready && !warnedEarlyRead) {
      warnedEarlyRead = true;
      console.warn(
        `${LOG_PREFIX} Env read before init finished, using "${current}". Await env.init() or render <EnvGate>.`
      );
    }
    return current;
  }

  function get(): E[Name] {
    return options.envs[name()];
  }

  /** Saves the env, runs `onBeforeSwitch`, then reloads the app. */
  async function switchTo(next: Name): Promise<void> {
    if (!__DEV__) {
      throw new Error(
        `${LOG_PREFIX} Switching env is disabled in release builds.`
      );
    }
    if (!isName(next)) {
      throw new Error(`${LOG_PREFIX} Unknown env "${String(next)}".`);
    }
    await init();
    if (next === current) return;

    await options.onBeforeSwitch?.(current, next);
    await options.storage.set(storageKey, next);
    DevSettings.reload(`Switched env to ${next}`);
  }

  function registerMenu(): void {
    // Titles stay static: DevSettings can't rename items after adding them.
    for (const envName of Object.keys(options.envs) as Name[]) {
      devActions.register({
        id: `env:${envName}`,
        title: `Env → ${envName}`,
        onPress: () =>
          envName === current
            ? notify(`Already on "${envName}".`)
            : switchTo(envName),
      });
    }
  }

  function useEnv(): E[Name] {
    return options.envs[useSyncExternalStore(subscribe, () => current)];
  }

  function EnvGate({
    children,
    fallback = null,
  }: {
    children: ReactNode;
    fallback?: ReactNode;
  }) {
    const isReady = useSyncExternalStore(subscribe, () => ready);
    return <>{isReady ? children : fallback}</>;
  }

  // Sync adapters resolve here, so the env is ready before the first render.
  init();

  return {
    envs: options.envs,
    storageKey,
    init,
    name,
    get,
    switchTo,
    useEnv,
    EnvGate,
  };
}

export type Env = ReturnType<typeof createEnv>;
