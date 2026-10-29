import { DevSettings } from 'react-native';
import { DEFAULT_ENV_KEY } from '../env';
import { clearStorage, resetAndReload } from '../presets';
import type { StorageAdapter } from '../types';

beforeEach(() => {
  jest.spyOn(DevSettings, 'reload').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('clearStorage keeps the selected env', async () => {
  const data = new Map([
    [DEFAULT_ENV_KEY, 'staging'],
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

  expect(Object.fromEntries(data)).toEqual({ [DEFAULT_ENV_KEY]: 'staging' });
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
