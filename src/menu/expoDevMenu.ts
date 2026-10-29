import { LOG_PREFIX } from '../notify';
import type { MenuAdapter, MenuItem } from '../types';

export type ExpoDevMenuModule = {
  registerDevMenuItems(
    items: { name: string; callback: () => void; shouldCollapse?: boolean }[]
  ): Promise<void>;
};

// On a cold start JS can run before the Android activity exists, and the
// call is rejected with ERR_MISSING_ACTIVITY.
const RETRY_DELAYS_MS = [100, 250, 500, 1000, 2000, 4000];

/**
 * `registerDevMenuItems` replaces the whole list on each call, so changes
 * are batched into one call per tick, and a failed call can simply be
 * retried with the latest list.
 */
export function createExpoDevMenuAdapter(
  devMenu: ExpoDevMenuModule
): MenuAdapter {
  let latest: MenuItem[] = [];
  let scheduled = false;

  function flush(attempt: number): void {
    devMenu
      .registerDevMenuItems(
        latest.map((item) => ({
          name: item.title,
          callback: item.run,
          shouldCollapse: true,
        }))
      )
      .catch((error) => {
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          console.warn(
            `${LOG_PREFIX} expo-dev-menu registration failed`,
            error
          );
          return;
        }
        setTimeout(() => flush(attempt + 1), delay);
      });
  }

  return {
    name: 'expo-dev-menu',
    dynamicTitles: true,
    sync(items) {
      latest = items;
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        flush(0);
      }, 0);
    },
  };
}
