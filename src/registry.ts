import { detectMenuAdapter } from './menu/detect';
import { LOG_PREFIX, notify } from './notify';
import type { DevAction, DevActionHandler, MenuAdapter } from './types';

const actions = new Map<string, DevAction>();
// `undefined` = not detected yet, `null` = no menu available (e.g. Expo Go).
let adapter: MenuAdapter | null | undefined;

const noop = () => {};

function getAdapter(): MenuAdapter | null {
  if (adapter === undefined) {
    adapter = detectMenuAdapter();
  }
  return adapter;
}

function run(title: string, onPress: DevActionHandler): void {
  Promise.resolve()
    .then(onPress)
    .catch((error: unknown) => {
      console.error(`${LOG_PREFIX} "${title}" failed`, error);
      notify(
        `"${title}" failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
}

function sync(): void {
  getAdapter()?.sync(
    Array.from(actions.values(), ({ title, onPress }) => ({
      title,
      run: () => run(title, onPress),
    }))
  );
}

export const devActions = {
  /**
   * Adds or replaces an action. Returns a function that removes it.
   * No-op in release builds.
   */
  register(action: DevAction): () => void {
    if (!__DEV__) return noop;

    for (const existing of actions.values()) {
      if (existing.id !== action.id && existing.title === action.title) {
        console.warn(
          `${LOG_PREFIX} "${action.title}" is used by both "${existing.id}" and "${action.id}". Titles must be unique.`
        );
      }
    }

    actions.set(action.id, action);
    sync();

    return () => {
      if (actions.get(action.id) === action) {
        actions.delete(action.id);
        sync();
      }
    };
  },

  /** Ids of the registered actions, in menu order. */
  list(): string[] {
    return Array.from(actions.keys());
  },
};

/**
 * Overrides menu detection, e.g. to show actions in a custom trigger.
 * Pass `undefined` to go back to auto-detection.
 */
export function setMenuAdapter(next: MenuAdapter | null | undefined): void {
  adapter = next;
  if (next) sync();
}
