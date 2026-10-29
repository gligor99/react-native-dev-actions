import { Alert, DevSettings } from 'react-native';
import type { StorageAdapter } from '../types';
import { createFakeMenu, flushPromises, setDev } from '../__fixtures__/helpers';

const envs = {
  dev: { apiUrl: 'http://localhost' },
  staging: { apiUrl: 'https://staging.example.com' },
  prod: { apiUrl: 'https://example.com' },
};
const KEY = '@react-native-dev-actions/env';

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

function load() {
  let mod!: typeof import('../env');
  let registry!: typeof import('../registry');
  jest.isolateModules(() => {
    registry = require('../registry');
    mod = require('../env');
  });
  const menu = createFakeMenu();
  registry.setMenuAdapter(menu);
  return { createEnv: mod.createEnv, menu };
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

it('uses the default env on first launch', () => {
  const { createEnv } = load();

  const env = createEnv({ envs, default: 'prod', storage: memoryStorage() });

  expect(env.name()).toBe('prod');
  expect(env.get().apiUrl).toBe('https://example.com');
});

it('reads a sync stored env immediately', () => {
  const { createEnv } = load();

  const env = createEnv({
    envs,
    default: 'prod',
    storage: memoryStorage({ [KEY]: 'staging' }),
  });

  expect(env.name()).toBe('staging');
});

it('reads an async stored env after init', async () => {
  const { createEnv } = load();

  const env = createEnv({
    envs,
    default: 'prod',
    storage: memoryStorage({ [KEY]: 'staging' }, true),
  });
  await env.init();

  expect(env.name()).toBe('staging');
});

it('warns when read before async init finishes', () => {
  const { createEnv } = load();

  const env = createEnv({
    envs,
    default: 'prod',
    storage: memoryStorage({ [KEY]: 'staging' }, true),
  });

  expect(env.name()).toBe('prod');
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('before init')
  );
});

it('falls back to the default for an unknown stored env', () => {
  const { createEnv } = load();

  const env = createEnv({
    envs,
    default: 'prod',
    storage: memoryStorage({ [KEY]: 'removed-env' }),
  });

  expect(env.name()).toBe('prod');
});

it('runs onBeforeSwitch, saves, then reloads', async () => {
  const { createEnv } = load();
  const calls: string[] = [];
  const storage = memoryStorage();
  storage.set.mockImplementation((key, value) => {
    calls.push(`set ${value}`);
    storage.data.set(key, value);
  });
  (DevSettings.reload as jest.Mock).mockImplementation(() =>
    calls.push('reload')
  );

  const env = createEnv({
    envs,
    default: 'prod',
    storage,
    onBeforeSwitch: (from, to) => {
      calls.push(`wipe ${from}->${to}`);
    },
  });
  await env.switchTo('staging');

  expect(calls).toEqual(['wipe prod->staging', 'set staging', 'reload']);
});

it('does nothing when switching to the current env', async () => {
  const { createEnv } = load();
  const onBeforeSwitch = jest.fn();

  const env = createEnv({
    envs,
    default: 'prod',
    storage: memoryStorage(),
    onBeforeSwitch,
  });
  await env.switchTo('prod');

  expect(onBeforeSwitch).not.toHaveBeenCalled();
  expect(DevSettings.reload).not.toHaveBeenCalled();
});

it('adds a menu item per env', async () => {
  const { createEnv, menu } = load();

  createEnv({ envs, default: 'prod', storage: memoryStorage() });
  menu.press('Env → staging');
  await flushPromises();

  expect(menu.titles()).toEqual(['Env → dev', 'Env → staging', 'Env → prod']);
  expect(DevSettings.reload).toHaveBeenCalledWith('Switched env to staging');
});

it('skips menu items when menu is false', () => {
  const { createEnv, menu } = load();

  createEnv({ envs, default: 'prod', storage: memoryStorage(), menu: false });

  expect(menu.titles()).toEqual([]);
});

describe('release builds', () => {
  it('ignores the stored env and never reads storage', () => {
    setDev(false);
    const { createEnv } = load();
    const storage = memoryStorage({ [KEY]: 'staging' });

    const env = createEnv({ envs, default: 'prod', storage });

    expect(env.name()).toBe('prod');
    expect(storage.get).not.toHaveBeenCalled();
  });

  it('refuses to switch', async () => {
    setDev(false);
    const { createEnv } = load();

    const env = createEnv({ envs, default: 'prod', storage: memoryStorage() });

    await expect(env.switchTo('staging')).rejects.toThrow(
      'disabled in release'
    );
  });
});
