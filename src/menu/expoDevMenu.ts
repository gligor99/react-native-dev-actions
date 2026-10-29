import { LOG_PREFIX } from '../notify';
import type { MenuAdapter, MenuItem } from '../types';

export type ExpoDevMenuModule = {
  registerDevMenuItems(
    items: { name: string; callback: () => void; shouldCollapse?: boolean }[]
  ): Promise<void>;
};

/**
 * `registerDevMenuItems` replaces the whole list on each call, so changes
 * are batched into one call per tick.
 */
export function createExpoDevMenuAdapter(
  devMenu: ExpoDevMenuModule
): MenuAdapter {
  let latest: MenuItem[] = [];
  let scheduled = false;

  return {
    name: 'expo-dev-menu',
    sync(items) {
      latest = items;
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        devMenu
          .registerDevMenuItems(
            latest.map((item) => ({
              name: item.title,
              callback: item.run,
              shouldCollapse: true,
            }))
          )
          .catch((error) => {
            console.warn(
              `${LOG_PREFIX} expo-dev-menu registration failed`,
              error
            );
          });
      }, 0);
    },
  };
}
