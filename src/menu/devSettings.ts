import { DevSettings } from 'react-native';
import { notify } from '../notify';
import type { MenuAdapter } from '../types';

/**
 * `DevSettings.addMenuItem` is append-only: items can't be renamed or
 * removed. Each title is added natively once and forwards to whatever
 * handler is current for that title.
 */
export function createDevSettingsAdapter(): MenuAdapter {
  const added = new Set<string>();
  let handlers = new Map<string, () => void>();

  return {
    name: 'dev-settings',
    sync(items) {
      handlers = new Map(items.map((item) => [item.title, item.run]));

      for (const { title } of items) {
        if (added.has(title)) continue;
        added.add(title);
        DevSettings.addMenuItem(title, () => {
          const run = handlers.get(title);
          if (run) {
            run();
          } else {
            notify(`"${title}" is not available right now.`);
          }
        });
      }
    },
  };
}
