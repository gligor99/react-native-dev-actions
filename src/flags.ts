import { useSyncExternalStore } from 'react';
import { DevSettings } from 'react-native';
import { LOG_PREFIX, notify } from './notify';
import { readStored } from './readStored';
import { devActions } from './registry';
import type { StorageAdapter } from './types';

export const DEFAULT_FLAGS_KEY = '@react-native-dev-actions/flags';

export type FlagDefinition =
  | boolean
  | { default: boolean; reload?: boolean }
  | { options: readonly string[]; default: string; reload?: boolean };

export type FlagValue<D> = D extends { options: readonly (infer O)[] }
  ? O
  : boolean;

export type FlagsOptions<F extends Record<string, FlagDefinition>> = {
  flags: F;
  storage: StorageAdapter;
  storageKey?: string;
  /**
   * Value from your flag provider (remote config, LaunchDarkly, ...).
   * Return `undefined` to fall back to the default. Overrides set from the
   * dev menu win over it in debug builds.
   */
  source?: (name: keyof F & string) => unknown;
  /** Add flag items to the dev menu. Defaults to `true`. */
  menu?: boolean;
};

type Definition = {
  default: boolean | string;
  options?: readonly string[];
  reload: boolean;
};

function normalize(definition: FlagDefinition): Definition {
  if (typeof definition === 'boolean') {
    return { default: definition, reload: false };
  }
  return {
    default: definition.default,
    options: 'options' in definition ? definition.options : undefined,
    reload: definition.reload ?? false,
  };
}

export function createFlags<const F extends Record<string, FlagDefinition>>(
  options: FlagsOptions<F>
) {
  type Name = keyof F & string;
  type Value<N extends Name> = FlagValue<F[N]>;

  const storageKey = options.storageKey ?? DEFAULT_FLAGS_KEY;
  const definitions = new Map(
    Object.entries(options.flags).map(
      ([name, definition]) => [name as Name, normalize(definition)] as const
    )
  );
  const listeners = new Set<() => void>();
  let overrides: Partial<Record<Name, boolean | string>> = {};
  let ready = false;
  let initPromise: Promise<void> | undefined;
  let menuRegistered = false;
  let warnedEarlyRead = false;

  const isValid = (definition: Definition, value: unknown) =>
    definition.options
      ? typeof value === 'string' && definition.options.includes(value)
      : typeof value === 'boolean';

  for (const [name, definition] of definitions) {
    if (!isValid(definition, definition.default)) {
      console.warn(
        `${LOG_PREFIX} Default of flag "${name}" is not one of its options.`
      );
    }
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function definitionOf(name: Name): Definition {
    const definition = definitions.get(name);
    if (!definition) throw new Error(`${LOG_PREFIX} Unknown flag "${name}".`);
    return definition;
  }

  function finishInit(stored: string | null | undefined): void {
    if (stored != null) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        for (const [name, value] of Object.entries(parsed)) {
          const definition = definitions.get(name as Name);
          // Drops overrides of removed flags and options.
          if (definition && isValid(definition, value)) {
            overrides[name as Name] = value as boolean | string;
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} Ignoring invalid flag overrides`, error);
      }
    }
    ready = true;
    if (options.menu !== false) registerMenu();
    listeners.forEach((listener) => listener());
  }

  /** Reads stored overrides. Safe to call many times. */
  function init(): Promise<void> {
    if (initPromise) return initPromise;

    // Release builds ignore overrides, like env.
    if (__DEV__) {
      initPromise = readStored(options.storage, storageKey, finishInit);
    } else {
      ready = true;
      initPromise = Promise.resolve();
    }
    return initPromise;
  }

  /** Override (debug only), then `source`, then the default. */
  function get<N extends Name>(name: N): Value<N> {
    const definition = definitionOf(name);
    if (__DEV__) {
      if (!ready && !warnedEarlyRead) {
        warnedEarlyRead = true;
        console.warn(
          `${LOG_PREFIX} Flag read before init finished. Await flags.init() or render <DevActionsGate>.`
        );
      }
      if (Object.hasOwn(overrides, name)) return overrides[name] as Value<N>;
    }
    const sourced = options.source?.(name);
    return (
      isValid(definition, sourced) ? sourced : definition.default
    ) as Value<N>;
  }

  function persist() {
    return options.storage.set(storageKey, JSON.stringify(overrides));
  }

  function afterChange(changed: Name[]): void {
    if (changed.some((name) => definitionOf(name).reload)) {
      DevSettings.reload('Flag changed');
      return;
    }
    listeners.forEach((listener) => listener());
    if (menuRegistered) registerMenu();
  }

  /** Overrides a flag locally. Reloads if the flag has `reload: true`. */
  async function set<N extends Name>(name: N, value: Value<N>): Promise<void> {
    if (!__DEV__) {
      throw new Error(
        `${LOG_PREFIX} Flag overrides are disabled in release builds.`
      );
    }
    if (!isValid(definitionOf(name), value)) {
      throw new Error(`${LOG_PREFIX} Invalid value for flag "${name}".`);
    }
    await init();
    overrides = { ...overrides, [name]: value };
    await persist();
    afterChange([name]);
  }

  /** Removes all local overrides. */
  async function reset(): Promise<void> {
    if (!__DEV__) {
      throw new Error(
        `${LOG_PREFIX} Flag overrides are disabled in release builds.`
      );
    }
    await init();
    const changed = Object.keys(overrides) as Name[];
    if (changed.length === 0) return;
    overrides = {};
    await persist();
    afterChange(changed);
  }

  function registerMenu(): void {
    menuRegistered = true;
    // DevSettings can't rename items, so static titles + a toast there.
    const dynamic = devActions.supportsDynamicTitles();

    for (const [name, definition] of definitions) {
      const current = get(name);
      const announce = (label: string) => {
        if (!dynamic && !definition.reload) notify(`${name} → ${label}`);
      };

      if (definition.options) {
        for (const option of definition.options) {
          devActions.register({
            id: `flag:${name}:${option}`,
            title: dynamic
              ? `${name}: ${option}${option === current ? ' ✓' : ''}`
              : `${name} → ${option}`,
            onPress: async () => {
              await set(name, option as Value<Name>);
              announce(option);
            },
          });
        }
      } else {
        devActions.register({
          id: `flag:${name}`,
          title: dynamic
            ? `${name}: ${current ? 'ON' : 'OFF'}`
            : `Toggle ${name}`,
          onPress: async () => {
            const next = !get(name);
            await set(name, next as Value<Name>);
            announce(next ? 'ON' : 'OFF');
          },
        });
      }
    }

    devActions.register({
      id: 'flags:reset',
      title: 'Flags → reset overrides',
      onPress: async () => {
        const names = Object.keys(overrides) as Name[];
        await reset();
        if (names.length === 0) {
          notify('No flag overrides set.');
        } else if (!names.some((name) => definitionOf(name).reload)) {
          notify('Flag overrides cleared.');
        }
      },
    });
  }

  function useFlag<N extends Name>(name: N): Value<N> {
    return useSyncExternalStore(subscribe, () => get(name));
  }

  // Sync adapters resolve here, so flags are ready before the first render.
  init();

  return {
    flags: options.flags,
    storageKey,
    init,
    ready: () => ready,
    subscribe,
    get,
    set,
    reset,
    /** Current local overrides, e.g. for bug reports. */
    overrides: (): Partial<Record<Name, boolean | string>> => ({
      ...overrides,
    }),
    useFlag,
  };
}

export type Flags = ReturnType<typeof createFlags>;
