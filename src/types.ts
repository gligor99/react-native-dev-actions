export type DevActionHandler = () => unknown;

export type DevAction = {
  /** Stable identifier. Registering the same id again replaces the action. */
  id: string;
  /** Label shown in the dev menu. */
  title: string;
  onPress: DevActionHandler;
};

export type MenuItem = {
  title: string;
  run: () => void;
};

/**
 * Where actions are shown. Built-in adapters target the RN dev menu
 * (`DevSettings`) and the Expo dev-client menu (`expo-dev-menu`).
 */
export interface MenuAdapter {
  name: string;
  /**
   * Whether an item's title can change after it was shown. When false,
   * stateful items (flags) keep a static title and show a toast instead.
   */
  dynamicTitles?: boolean;
  /** Receives the full, ordered list every time it changes. */
  sync(items: MenuItem[]): void;
}

/**
 * Persists the selected env and flag overrides. `get` may be sync (MMKV) or
 * async (AsyncStorage); async adapters require `init()` before first read.
 */
export interface StorageAdapter {
  get(
    key: string
  ): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string): void | Promise<void>;
  clear(): void | Promise<void>;
}
