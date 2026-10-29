import { Alert, DevSettings } from 'react-native';
import type { StorageAdapter } from '../types';
import { createFakeMenu, flushPromises, setDev } from '../__fixtures__/helpers';

const KEY = '@react-native-dev-actions/flags';

const definitions = {
  newCheckout: false,
  paywall: { options: ['control', 'v1', 'v2'], default: 'control' },
  analyticsSdk: { default: true, reload: true },
} as const;

function memoryStorage(initial: Record<string, string> = {}, async = false) {
  const data = new Map(Object.entries(initial));
  const wrap = <T>(value: T) => (async ? Promise.resolve(value) : value);
  const storage = {
    data,
    get: jest.fn((key: string) => wrap(data.get(key))),
    set: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
    clear: jest.fn(() => data.clear()),
  };
  return storage as typeof storage & StorageAdapter;
}

function load({ dynamicTitles = false } = {}) {
  let mod!: typeof import('../flags');
  let registry!: typeof import('../registry');
  jest.isolateModules(() => {
    registry = require('../registry');
    mod = require('../flags');
  });
  const menu = createFakeMenu({ dynamicTitles });
  registry.setMenuAdapter(menu);
  return { createFlags: mod.createFlags, menu };
}

beforeEach(() => {
  jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  setDev(true);
  jest.restoreAllMocks();
});

describe('values', () => {
  it('returns defaults', () => {
    const { createFlags } = load();

    const flags = createFlags({ flags: definitions, storage: memoryStorage() });

    expect(flags.get('newCheckout')).toBe(false);
    expect(flags.get('paywall')).toBe('control');
    expect(flags.get('analyticsSdk')).toBe(true);
  });

  it('prefers a valid source value over the default', () => {
    const { createFlags } = load();
    const remote: Record<string, unknown> = {
      newCheckout: true,
      paywall: 'v1',
    };

    const flags = createFlags({
      flags: definitions,
      storage: memoryStorage(),
      source: (name) => remote[name],
    });

    expect(flags.get('newCheckout')).toBe(true);
    expect(flags.get('paywall')).toBe('v1');
  });

  it('ignores source values of the wrong type or unknown options', () => {
    const { createFlags } = load();
    const remote: Record<string, unknown> = {
      newCheckout: 'yes',
      paywall: 'v9',
    };

    const flags = createFlags({
      flags: definitions,
      storage: memoryStorage(),
      source: (name) => remote[name],
    });

    expect(flags.get('newCheckout')).toBe(false);
    expect(flags.get('paywall')).toBe('control');
  });

  it('lets overrides win over source', async () => {
    const { createFlags } = load();

    const flags = createFlags({
      flags: definitions,
      storage: memoryStorage(),
      source: () => false,
    });
    await flags.set('newCheckout', true);

    expect(flags.get('newCheckout')).toBe(true);
  });
});

describe('storage', () => {
  it('persists overrides as one JSON key', async () => {
    const { createFlags } = load();
    const storage = memoryStorage();

    const flags = createFlags({ flags: definitions, storage });
    await flags.set('paywall', 'v2');
    await flags.set('newCheckout', true);

    expect(JSON.parse(storage.data.get(KEY)!)).toEqual({
      paywall: 'v2',
      newCheckout: true,
    });
  });

  it('loads stored overrides and drops invalid ones', () => {
    const { createFlags } = load();
    const storage = memoryStorage({
      [KEY]: JSON.stringify({
        paywall: 'v1',
        newCheckout: 'nope',
        removedFlag: true,
      }),
    });

    const flags = createFlags({ flags: definitions, storage });

    expect(flags.get('paywall')).toBe('v1');
    expect(flags.get('newCheckout')).toBe(false);
    expect(flags.overrides()).toEqual({ paywall: 'v1' });
  });

  it('ignores corrupt stored JSON', () => {
    const { createFlags } = load();

    const flags = createFlags({
      flags: definitions,
      storage: memoryStorage({ [KEY]: '{not json' }),
    });

    expect(flags.get('paywall')).toBe('control');
  });

  it('reads async storage after init', async () => {
    const { createFlags } = load();

    const flags = createFlags({
      flags: definitions,
      storage: memoryStorage({ [KEY]: '{"paywall":"v2"}' }, true),
    });
    expect(flags.ready()).toBe(false);
    await flags.init();

    expect(flags.ready()).toBe(true);
    expect(flags.get('paywall')).toBe('v2');
  });
});

describe('changes', () => {
  it('notifies subscribers on a live flag', async () => {
    const { createFlags } = load();
    const listener = jest.fn();

    const flags = createFlags({ flags: definitions, storage: memoryStorage() });
    flags.subscribe(listener);
    await flags.set('newCheckout', true);

    expect(listener).toHaveBeenCalled();
    expect(DevSettings.reload).not.toHaveBeenCalled();
  });

  it('reloads for a reload flag', async () => {
    const { createFlags } = load();

    const flags = createFlags({ flags: definitions, storage: memoryStorage() });
    await flags.set('analyticsSdk', false);

    expect(DevSettings.reload).toHaveBeenCalledWith('Flag changed');
  });

  it('reset removes all overrides', async () => {
    const { createFlags } = load();
    const storage = memoryStorage();

    const flags = createFlags({ flags: definitions, storage });
    await flags.set('paywall', 'v1');
    await flags.reset();

    expect(flags.get('paywall')).toBe('control');
    expect(storage.data.get(KEY)).toBe('{}');
  });

  it('rejects invalid values', async () => {
    const { createFlags } = load();

    const flags = createFlags({ flags: definitions, storage: memoryStorage() });

    await expect(flags.set('paywall', 'v9' as 'v1')).rejects.toThrow(
      'Invalid value'
    );
  });
});

describe('menu', () => {
  it('shows state in titles when the menu supports it', async () => {
    const { createFlags, menu } = load({ dynamicTitles: true });

    createFlags({ flags: definitions, storage: memoryStorage() });
    menu.press('newCheckout: OFF');
    await flushPromises();

    expect(menu.titles()).toEqual([
      'newCheckout: ON',
      'paywall: control ✓',
      'paywall: v1',
      'paywall: v2',
      'analyticsSdk: ON',
      'Flags → reset overrides',
    ]);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('marks the selected enum option', async () => {
    const { createFlags, menu } = load({ dynamicTitles: true });

    createFlags({ flags: definitions, storage: memoryStorage() });
    menu.press('paywall: v2');
    await flushPromises();

    expect(menu.titles()).toContain('paywall: v2 ✓');
    expect(menu.titles()).toContain('paywall: control');
  });

  it('uses static titles and a toast when titles are fixed', async () => {
    const { createFlags, menu } = load({ dynamicTitles: false });

    createFlags({ flags: definitions, storage: memoryStorage() });
    menu.press('Toggle newCheckout');
    await flushPromises();

    expect(menu.titles()).toEqual([
      'Toggle newCheckout',
      'paywall → control',
      'paywall → v1',
      'paywall → v2',
      'Toggle analyticsSdk',
      'Flags → reset overrides',
    ]);
    expect(Alert.alert).toHaveBeenCalledWith('Dev actions', 'newCheckout → ON');
  });

  it('says so when there is nothing to reset', async () => {
    const { createFlags, menu } = load();

    createFlags({ flags: definitions, storage: memoryStorage() });
    menu.press('Flags → reset overrides');
    await flushPromises();

    expect(Alert.alert).toHaveBeenCalledWith(
      'Dev actions',
      'No flag overrides set.'
    );
  });
});

describe('release builds', () => {
  it('ignores stored overrides and never reads storage', () => {
    setDev(false);
    const { createFlags } = load();
    const storage = memoryStorage({ [KEY]: '{"paywall":"v2"}' });

    const flags = createFlags({
      flags: definitions,
      storage,
      source: (name) => (name === 'newCheckout' ? true : undefined),
    });

    expect(flags.get('paywall')).toBe('control');
    expect(flags.get('newCheckout')).toBe(true);
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('refuses overrides', async () => {
    setDev(false);
    const { createFlags } = load();

    const flags = createFlags({ flags: definitions, storage: memoryStorage() });

    await expect(flags.set('newCheckout', true)).rejects.toThrow(
      'disabled in release'
    );
  });
});
