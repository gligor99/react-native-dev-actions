# react-native-dev-actions

Dev menu actions, env switcher and feature flags for React Native & Expo.

Add your own items to the dev menu (clear storage, log out, reset the offline DB, …), switch between dev / staging / prod and flip feature flags without rebuilding.

- Works with the **React Native dev menu** (`DevSettings`) and the **Expo dev-client menu** (`expo-dev-menu`), detected automatically.
- **Hot-reload safe**: re-registering replaces the handler instead of adding duplicate items.
- **Release-safe**: in release builds registering does nothing, and env and flags are locked to their defaults without ever reading storage.
- Pure JS, no native code, no required dependencies.

## Installation

```sh
npm install react-native-dev-actions
```

Expo: custom menu items need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`expo-dev-client`). Expo Go does not support them, so the library logs a warning and does nothing there.

## Dev menu actions

Register global actions once, at app startup:

```ts
import { devActions } from 'react-native-dev-actions';

devActions.register({
  id: 'reset-db',
  title: 'Reset offline DB',
  onPress: async () => {
    await db.reset();
  },
});
```

Actions that need React state or context go in a hook. The item is registered while the component is mounted:

```tsx
import { useDevAction } from 'react-native-dev-actions';

function Profile() {
  const auth = useAuth();

  useDevAction({ id: 'logout', title: 'Log out', onPress: () => auth.logout() });
  // ...
}
```

Errors thrown by a handler are logged and shown as an alert/toast instead of crashing the app.

## Env switcher

```ts
// env.ts
import { storage } from './storage'; // your MMKV instance
import { createEnv, mmkvAdapter } from 'react-native-dev-actions';

export const env = createEnv({
  envs: {
    dev: { apiUrl: process.env.EXPO_PUBLIC_DEV_API_URL! },
    staging: { apiUrl: process.env.EXPO_PUBLIC_STAGING_API_URL! },
    prod: { apiUrl: 'https://api.example.com' },
  },
  default: 'prod',
  storage: mmkvAdapter(storage),
  onBeforeSwitch: async (from, to) => {
    // Wipe anything that belongs to the old env.
    await tokens.clear();
    await db.reset();
  },
});
```

This adds `Env → dev`, `Env → staging` and `Env → prod` to the dev menu. Switching runs `onBeforeSwitch`, saves the choice and reloads the app, so nothing from the old env stays in memory.

Read the env anywhere:

```ts
env.name(); // 'staging'
env.get().apiUrl;

// in components
const { apiUrl } = env.useEnv();
```

### Storage adapters

| Adapter | Read | Startup |
| --- | --- | --- |
| `mmkvAdapter(mmkv)` | sync | Ready immediately |
| `asyncStorageAdapter(AsyncStorage)` | async | Wrap the app in `<DevActionsGate>` or `await env.init()` |

```tsx
import { DevActionsGate } from 'react-native-dev-actions';

export default function App() {
  return (
    <DevActionsGate wait={[env, flags]} fallback={<Splash />}>
      <Root />
    </DevActionsGate>
  );
}
```

`<env.EnvGate>` does the same for the env alone.

Anything with `get`, `set` and `clear` works as a custom adapter.

### Release builds

In release builds (`__DEV__ === false`):

- `env.name()` always returns `default`. Storage is **not read**, so a debug build installed over the same bundle id can't leak `staging` into release.
- `env.switchTo()` throws.
- No menu items are registered.

The configs of the other envs are still in the JS bundle. Keep non-prod URLs and keys in env vars that are only set for development builds (for example `EXPO_PUBLIC_*` or `react-native-config`) instead of hardcoding them.

## Feature flags

```ts
import { createFlags } from 'react-native-dev-actions';

export const flags = createFlags({
  flags: {
    newCheckout: false,
    paywall: { options: ['control', 'v1', 'v2'], default: 'control' },
    // Read once at startup, so changing it reloads the app.
    analyticsSdk: { default: true, reload: true },
  },
  storage: mmkvAdapter(storage),
  // Optional: your flag provider. Dev menu overrides win over it.
  source: (name) => remoteConfig.getValue(name),
});
```

```ts
const newCheckout = flags.useFlag('newCheckout'); // boolean, re-renders on change
const paywall = flags.useFlag('paywall'); // 'control' | 'v1' | 'v2'

flags.get('paywall'); // outside React
```

A flag's value is the dev menu override if there is one, otherwise `source(name)` (when it returns a valid value), otherwise the default.

The dev menu gets one item per boolean flag, one per enum option, and `Flags → reset overrides`. In the Expo dev-client menu the titles show the current state (`newCheckout: ON`, `paywall: v2 ✓`). In the RN dev menu titles can't change, so they stay static (`Toggle newCheckout`, `paywall → v2`) and a toast shows the new value.

Changes apply live. Flags marked `reload: true` reload the app instead, for values your code reads only once at startup.

Overrides are stored as one JSON key and are ignored in release builds, where `get` returns `source(name) ?? default`.

## Presets

```ts
import {
  clearStorage,
  copyDebugInfo,
  resetAndReload,
  showEnvInfo,
} from 'react-native-dev-actions/presets';

devActions.register({ id: 'env-info', title: 'Show env info', onPress: showEnvInfo(env) });
devActions.register({ id: 'clear', title: 'Clear storage', onPress: clearStorage(storage) });
devActions.register({
  id: 'reset-db',
  title: 'Reset offline DB',
  onPress: resetAndReload(() => db.reset(), 'Offline DB reset'),
});
devActions.register({
  id: 'debug-info',
  title: 'Copy debug info',
  onPress: copyDebugInfo({
    env,
    flags,
    copy: Clipboard.setStringAsync, // expo-clipboard, optional
    fields: async () => ({ appVersion, userId }),
  }),
});
```

- `clearStorage(storage, { keep?, reload? })` clears the storage but keeps the selected env and flag overrides, then reloads.
- `resetAndReload(fn, reason?)` runs your reset (SQLite, offline cache, …), then reloads.
- `showEnvInfo(env)` shows an alert with the current env and its values.
- `copyDebugInfo({ env?, flags?, fields?, copy? })` builds a plain-text report for bug tickets and copies it with `copy`. Without `copy` it opens the share sheet. Env values are left out on purpose, since they may contain keys. Add what you need through `fields`.

```
platform: android 36
reactNative: 0.88.1
env: staging
flagOverrides: newCheckout=true, paywall=v2
appVersion: 1.4.0
time: 2026-10-29T16:18:40.140Z
```

## Custom menu

To show actions somewhere other than the dev menu, pass your own adapter:

```ts
import { setMenuAdapter } from 'react-native-dev-actions';

setMenuAdapter({
  name: 'my-sheet',
  dynamicTitles: true, // titles may change, e.g. flag state
  sync(items) {
    // items: { title, run }[], the full list every time it changes
  },
});
```

## Limitations

- `DevSettings` items can't be renamed or removed. When a `useDevAction` component unmounts, its item stays in the RN dev menu and shows "not available" when pressed. In the Expo dev-client menu, the item is removed.
- Item titles must be unique, because `DevSettings` uses the title as the id.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
