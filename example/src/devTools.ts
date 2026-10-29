import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  asyncStorageAdapter,
  createEnv,
  createFlags,
  devActions,
} from 'react-native-dev-actions';
import {
  clearStorage,
  copyDebugInfo,
  resetAndReload,
  showEnvInfo,
} from 'react-native-dev-actions/presets';

const storage = asyncStorageAdapter(AsyncStorage);

// Stand-in for an offline DB (SQLite, WatermelonDB, ...).
export const fakeDb = {
  rows: ['cached row 1', 'cached row 2'],
  async reset() {
    fakeDb.rows = [];
  },
};

export const env = createEnv({
  envs: {
    dev: { apiUrl: 'http://localhost:3000' },
    staging: { apiUrl: 'https://staging.example.com' },
    prod: { apiUrl: 'https://api.example.com' },
  },
  default: 'prod',
  storage,
  onBeforeSwitch: async () => {
    await AsyncStorage.removeItem('authToken');
    await fakeDb.reset();
  },
});

export const flags = createFlags({
  flags: {
    newCheckout: false,
    paywall: { options: ['control', 'v1', 'v2'], default: 'control' },
  },
  storage,
});

devActions.register({
  id: 'env-info',
  title: 'Show env info',
  onPress: showEnvInfo(env),
});

devActions.register({
  id: 'clear-storage',
  title: 'Clear storage',
  onPress: clearStorage(storage),
});

devActions.register({
  id: 'reset-db',
  title: 'Reset offline DB',
  onPress: resetAndReload(fakeDb.reset, 'Offline DB reset'),
});

// No `copy` passed, so this opens the share sheet. Pass
// `copy: Clipboard.setStringAsync` (expo-clipboard) to copy instead.
devActions.register({
  id: 'debug-info',
  title: 'Share debug info',
  onPress: copyDebugInfo({
    env,
    flags,
    fields: () => ({ app: 'react-native-dev-actions-example 1.0.0' }),
  }),
});
