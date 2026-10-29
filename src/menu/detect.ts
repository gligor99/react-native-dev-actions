import { LOG_PREFIX } from '../notify';
import type { MenuAdapter } from '../types';
import { createDevSettingsAdapter } from './devSettings';
import { createExpoDevMenuAdapter } from './expoDevMenu';

type ExpoGlobal = {
  modules?: {
    ExpoDevMenu?: unknown;
    ExponentConstants?: { executionEnvironment?: string };
  };
};

/**
 * Expo dev-client replaces the RN dev menu, so `DevSettings` items don't
 * show there; use `expo-dev-menu` when its native module is present.
 * Expo Go supports neither.
 */
export function detectMenuAdapter(): MenuAdapter | null {
  const modules = (globalThis as { expo?: ExpoGlobal }).expo?.modules;

  if (modules?.ExponentConstants?.executionEnvironment === 'storeClient') {
    console.warn(
      `${LOG_PREFIX} Expo Go does not support custom dev menu items. Use a development build.`
    );
    return null;
  }

  if (modules?.ExpoDevMenu) {
    try {
      return createExpoDevMenuAdapter(require('expo-dev-menu'));
    } catch {
      // Native module without the JS package: fall through to DevSettings.
    }
  }

  return createDevSettingsAdapter();
}
