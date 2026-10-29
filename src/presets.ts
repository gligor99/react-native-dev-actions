import { Alert, DevSettings, Platform, Share } from 'react-native';
import { DEFAULT_ENV_KEY } from './env';
import { DEFAULT_FLAGS_KEY } from './flags';
import { notify } from './notify';
import type { DevActionHandler, StorageAdapter } from './types';

type EnvLike = {
  name(): string;
  get(): object;
};

/**
 * Clears the storage, keeping the selected env and flag overrides (and any
 * other `keep` keys), then reloads.
 */
export function clearStorage(
  storage: StorageAdapter,
  {
    keep = [DEFAULT_ENV_KEY, DEFAULT_FLAGS_KEY],
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

type DebugInfoOptions = {
  env?: { name(): string };
  flags?: { overrides(): Record<string, unknown> };
  /** Extra lines, e.g. app version, user id, push token. */
  fields?: () => Record<string, unknown> | Promise<Record<string, unknown>>;
  /**
   * Copies the text, e.g. `Clipboard.setStringAsync` from expo-clipboard.
   * Without it the text opens in the share sheet.
   */
  copy?: (text: string) => unknown;
};

function reactNativeVersion(): string {
  const { major, minor, patch, prerelease } =
    Platform.constants.reactNativeVersion;
  return `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}`;
}

/**
 * Builds a plain-text bug report header. Env values are left out on
 * purpose (they may hold keys); add what you need through `fields`.
 */
export async function collectDebugInfo({
  env,
  flags,
  fields,
}: Omit<DebugInfoOptions, 'copy'> = {}): Promise<string> {
  const info: Record<string, unknown> = {
    platform: `${Platform.OS} ${Platform.Version}`,
    reactNative: reactNativeVersion(),
  };
  if (env) info.env = env.name();
  if (flags) {
    const overridden = Object.entries(flags.overrides());
    info.flagOverrides = overridden.length
      ? overridden.map(([name, value]) => `${name}=${String(value)}`).join(', ')
      : 'none';
  }
  Object.assign(info, await fields?.());
  info.time = new Date().toISOString();

  return Object.entries(info)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');
}

/** Copies debug info to the clipboard, or opens the share sheet. */
export function copyDebugInfo({
  copy,
  ...options
}: DebugInfoOptions = {}): DevActionHandler {
  return async () => {
    const text = await collectDebugInfo(options);
    if (copy) {
      await copy(text);
      notify('Debug info copied.');
    } else {
      await Share.share({ message: text });
    }
  };
}
