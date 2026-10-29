import type { MenuAdapter, MenuItem } from '../types';

export type FakeMenu = MenuAdapter & {
  items: MenuItem[];
  titles(): string[];
  press(title: string): void;
};

export function createFakeMenu({ dynamicTitles = false } = {}): FakeMenu {
  const menu: FakeMenu = {
    name: 'fake',
    dynamicTitles,
    items: [],
    sync(items) {
      menu.items = items;
    },
    titles: () => menu.items.map((item) => item.title),
    press(title) {
      const item = menu.items.find((i) => i.title === title);
      if (!item) throw new Error(`No menu item "${title}"`);
      item.run();
    },
  };
  return menu;
}

export const flushPromises = () =>
  new Promise((resolve) => jest.requireActual('timers').setImmediate(resolve));

export function setDev(value: boolean): void {
  (globalThis as { __DEV__?: boolean }).__DEV__ = value;
}
