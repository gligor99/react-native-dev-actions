import { Alert, DevSettings, Share } from 'react-native';
import { DEFAULT_ENV_KEY } from '../env';
import { DEFAULT_FLAGS_KEY } from '../flags';
import {
  clearStorage,
  collectDebugInfo,
  copyDebugInfo,
  resetAndReload,
} from '../presets';
import type { StorageAdapter } from '../types';

beforeEach(() => {
  jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('clearStorage keeps the selected env and flag overrides', async () => {
  const data = new Map([
    [DEFAULT_ENV_KEY, 'staging'],
    [DEFAULT_FLAGS_KEY, '{"paywall":"v2"}'],
    ['token', 'abc'],
  ]);
  const storage: StorageAdapter = {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
    clear: () => data.clear(),
  };

  await clearStorage(storage)();

  expect(Object.fromEntries(data)).toEqual({
    [DEFAULT_ENV_KEY]: 'staging',
    [DEFAULT_FLAGS_KEY]: '{"paywall":"v2"}',
  });
  expect(DevSettings.reload).toHaveBeenCalledWith('Storage cleared');
});

it('resetAndReload reloads after the reset finishes', async () => {
  const calls: string[] = [];
  (DevSettings.reload as jest.Mock).mockImplementation(() =>
    calls.push('reload')
  );

  await resetAndReload(async () => {
    calls.push('reset');
  }, 'DB reset')();

  expect(calls).toEqual(['reset', 'reload']);
  expect(DevSettings.reload).toHaveBeenCalledWith('DB reset');
});

describe('debug info', () => {
  const env = { name: () => 'staging' };
  const flags = { overrides: () => ({ paywall: 'v2', newCheckout: true }) };

  it('collects platform, env name, overrides and custom fields', async () => {
    const text = await collectDebugInfo({
      env,
      flags,
      fields: async () => ({ appVersion: '1.2.3', userId: 42 }),
    });

    expect(text).toMatch(/^platform: ios /);
    expect(text).toMatch(/\nreactNative: \d+\.\d+\.\d+/);
    expect(text).toContain('\nenv: staging\n');
    expect(text).toContain('\nflagOverrides: paywall=v2, newCheckout=true\n');
    expect(text).toContain('\nappVersion: 1.2.3\nuserId: 42\n');
    expect(text).toMatch(/\ntime: \d{4}-\d{2}-\d{2}T/);
  });

  it('copies with the given function', async () => {
    const copy = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await copyDebugInfo({ env, copy })();

    expect(copy).toHaveBeenCalledWith(expect.stringContaining('env: staging'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Dev actions',
      'Debug info copied.'
    );
  });

  it('falls back to the share sheet', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });

    await copyDebugInfo({ env })();

    expect(Share.share).toHaveBeenCalledWith({
      message: expect.stringContaining('env: staging'),
    });
  });
});
