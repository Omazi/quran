/**
 * Test support for the screens of the shell: renders a tree with a store and a language, as the
 * root layout does once the app has started.
 */

import { render } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { act, type ReactElement } from 'react';

import { initI18n, type AppLanguage } from '@/i18n';
import { AppStoreProvider, type AppStore } from '@/store';
import { createTestAppStore, type TestStoreData } from '@/store/test-support/test-store';
import { renderOnIOS } from '@/ui/test-support/environment';

import type { WritingDirectionPlatform } from '../writing-direction';

export interface RenderWithStoreOptions extends TestStoreData {
  /** Defaults to French, the reference language. */
  language?: AppLanguage;
  /** A store to use instead of a new one. */
  store?: AppStore;
  /**
   * Renders the controls of `@/ui` with their SwiftUI implementation, as an iPhone receives
   * them, and fails if one of them has no host.
   */
  onIOS?: boolean;
}

/** Renders the tree below a store. Returns the store, to check what the screen changed in it. */
export async function renderWithStore(
  tree: ReactElement,
  { language = 'fr', store, onIOS = false, ...data }: RenderWithStoreOptions = {},
): Promise<AppStore> {
  initI18n(language);
  const usedStore = store ?? createTestAppStore(data);
  const treeWithStore = <AppStoreProvider store={usedStore}>{tree}</AppStoreProvider>;
  if (onIOS) await renderOnIOS(treeWithStore);
  else await render(treeWithStore);
  return usedStore;
}

/**
 * A phone as far as the writing direction goes: its direction is fixed while the app runs, and a
 * recorded direction only waits for the next start.
 */
export function createFixedDirection(isRightToLeft: boolean) {
  let recorded = isRightToLeft;
  const platform: WritingDirectionPlatform = {
    isRightToLeft: () => isRightToLeft,
    setRightToLeft: jest.fn((next: boolean) => {
      recorded = next;
    }),
    restart: jest.fn(async () => {}),
  };
  return { platform, recorded: () => recorded };
}

/** Tells the app it came back to the foreground, as when the person returns from the settings. */
export async function returnToApp(): Promise<void> {
  const handlers = jest
    .mocked(AppState.addEventListener)
    .mock.calls.filter(([event]) => event === 'change')
    .map(([, handler]) => handler as (state: AppStateStatus) => void);
  await act(async () => {
    for (const handler of handlers) handler('active');
  });
}
