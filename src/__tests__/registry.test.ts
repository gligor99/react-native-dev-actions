import { Alert } from 'react-native';
import { createFakeMenu, flushPromises, setDev } from '../__fixtures__/helpers';

type Registry = typeof import('../registry');

function loadRegistry() {
  let registry!: Registry;
  jest.isolateModules(() => {
    registry = require('../registry');
  });
  const menu = createFakeMenu();
  registry.setMenuAdapter(menu);
  return { ...registry, menu };
}

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  setDev(true);
  jest.restoreAllMocks();
});

it('syncs actions to the menu in registration order', () => {
  const { devActions, menu } = loadRegistry();

  devActions.register({ id: 'a', title: 'A', onPress: () => {} });
  devActions.register({ id: 'b', title: 'B', onPress: () => {} });

  expect(menu.titles()).toEqual(['A', 'B']);
});

it('replaces the handler when an id is registered again', async () => {
  const { devActions, menu } = loadRegistry();
  const first = jest.fn();
  const second = jest.fn();

  devActions.register({ id: 'a', title: 'A', onPress: first });
  devActions.register({ id: 'a', title: 'A', onPress: second });
  menu.press('A');
  await flushPromises();

  expect(menu.titles()).toEqual(['A']);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

it('removes the action on unregister', () => {
  const { devActions, menu } = loadRegistry();

  const unregister = devActions.register({
    id: 'a',
    title: 'A',
    onPress: () => {},
  });
  unregister();

  expect(menu.titles()).toEqual([]);
});

it('ignores a stale unregister after the id was re-registered', () => {
  const { devActions, menu } = loadRegistry();

  const stale = devActions.register({ id: 'a', title: 'A', onPress: () => {} });
  devActions.register({ id: 'a', title: 'A2', onPress: () => {} });
  stale();

  expect(menu.titles()).toEqual(['A2']);
});

it('reports handler errors instead of throwing', async () => {
  const { devActions, menu } = loadRegistry();

  devActions.register({
    id: 'a',
    title: 'A',
    onPress: async () => {
      throw new Error('boom');
    },
  });
  menu.press('A');
  await flushPromises();

  expect(Alert.alert).toHaveBeenCalledWith('Dev actions', '"A" failed: boom');
});

it('warns on duplicate titles', () => {
  const { devActions } = loadRegistry();

  devActions.register({ id: 'a', title: 'Same', onPress: () => {} });
  devActions.register({ id: 'b', title: 'Same', onPress: () => {} });

  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('Titles must be unique')
  );
});

it('does nothing in release builds', () => {
  setDev(false);
  const { devActions, menu } = loadRegistry();

  devActions.register({ id: 'a', title: 'A', onPress: () => {} });

  expect(devActions.list()).toEqual([]);
  expect(menu.items).toEqual([]);
});
