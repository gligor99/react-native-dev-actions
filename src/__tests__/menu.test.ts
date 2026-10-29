import { Alert, DevSettings } from 'react-native';
import { createDevSettingsAdapter } from '../menu/devSettings';
import { createExpoDevMenuAdapter } from '../menu/expoDevMenu';

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete (globalThis as { expo?: unknown }).expo;
});

describe('DevSettings adapter', () => {
  function setup() {
    const native = new Map<string, () => unknown>();
    jest
      .spyOn(DevSettings, 'addMenuItem')
      .mockImplementation((title, handler) => {
        native.set(title, handler);
      });
    return { adapter: createDevSettingsAdapter(), native };
  }

  it('adds each title natively only once', () => {
    const { adapter } = setup();

    adapter.sync([{ title: 'A', run: () => {} }]);
    adapter.sync([{ title: 'A', run: () => {} }]);

    expect(DevSettings.addMenuItem).toHaveBeenCalledTimes(1);
  });

  it('forwards to the latest handler', () => {
    const { adapter, native } = setup();
    const latest = jest.fn();

    adapter.sync([{ title: 'A', run: () => {} }]);
    adapter.sync([{ title: 'A', run: latest }]);
    native.get('A')!();

    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('tells the user when a removed item is pressed', () => {
    const { adapter, native } = setup();

    adapter.sync([{ title: 'A', run: () => {} }]);
    adapter.sync([]);
    native.get('A')!();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Dev actions',
      '"A" is not available right now.'
    );
  });
});

describe('expo-dev-menu adapter', () => {
  it('batches syncs into one registerDevMenuItems call', () => {
    jest.useFakeTimers();
    const registerDevMenuItems = jest.fn(() => Promise.resolve());
    const adapter = createExpoDevMenuAdapter({ registerDevMenuItems });
    const run = () => {};

    adapter.sync([{ title: 'A', run }]);
    adapter.sync([
      { title: 'A', run },
      { title: 'B', run },
    ]);
    jest.runAllTimers();

    expect(registerDevMenuItems).toHaveBeenCalledTimes(1);
    expect(registerDevMenuItems).toHaveBeenCalledWith([
      { name: 'A', callback: run, shouldCollapse: true },
      { name: 'B', callback: run, shouldCollapse: true },
    ]);
  });
});

describe('detectMenuAdapter', () => {
  function detect(expo: unknown) {
    (globalThis as { expo?: unknown }).expo = expo;
    let result: ReturnType<typeof import('../menu/detect').detectMenuAdapter>;
    jest.isolateModules(() => {
      result = require('../menu/detect').detectMenuAdapter();
    });
    return result!;
  }

  it('uses DevSettings outside Expo', () => {
    expect(detect(undefined)?.name).toBe('dev-settings');
  });

  it('uses expo-dev-menu in a development build', () => {
    jest.doMock(
      'expo-dev-menu',
      () => ({ registerDevMenuItems: jest.fn(() => Promise.resolve()) }),
      { virtual: true }
    );

    expect(detect({ modules: { ExpoDevMenu: {} } })?.name).toBe(
      'expo-dev-menu'
    );
  });

  it('disables the menu in Expo Go', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const adapter = detect({
      modules: { ExponentConstants: { executionEnvironment: 'storeClient' } },
    });

    expect(adapter).toBeNull();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Expo Go')
    );
  });
});
