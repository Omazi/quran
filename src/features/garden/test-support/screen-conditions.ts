/**
 * Test support for the garden and home screens: the language shown, the conditions every state
 * is rendered in, and one check the design system's own helper does not make.
 */

import { screen } from '@testing-library/react-native';
import type { i18n as I18n } from 'i18next';

import { initI18n, type AppLanguage } from '@/i18n';
import {
  isSwiftUIHost,
  withDescendants,
  type DeviceConditions,
  type RenderedElement,
} from '@/ui/test-support/environment';

/** Shows the interface in a language, and returns the translations to compare with. */
export async function showLanguage(language: AppLanguage): Promise<I18n> {
  const i18n = initI18n(language);
  await i18n.changeLanguage(language);
  return i18n;
}

export interface ScreenConditions extends DeviceConditions {
  readonly language: AppLanguage;
}

/**
 * Light and dark, each in French (left to right) and in Arabic (right to left). On Android,
 * where a colour is a plain value a test can read; on iOS the system resolves it when it draws.
 */
export const SCREEN_CONDITIONS: readonly ScreenConditions[] = [
  { os: 'android', scheme: 'light', rightToLeft: false, language: 'fr' },
  { os: 'android', scheme: 'light', rightToLeft: true, language: 'ar' },
  { os: 'android', scheme: 'dark', rightToLeft: false, language: 'fr' },
  { os: 'android', scheme: 'dark', rightToLeft: true, language: 'ar' },
];

/** Under Jest every view of Expo UI is a stub of this type (see `@/ui/test-support`). */
const EXPO_UI_STUB = 'ViewManagerAdapter_ExpoUI';

/** Whether the nearest SwiftUI boundary above an element is a host, not the way back out. */
function isInsideSwiftUI(element: RenderedElement): boolean {
  for (let ancestor = element.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (isSwiftUIHost(ancestor)) return true;
    // Expo UI's view that puts React Native content back inside SwiftUI.
    if (ancestor.type === EXPO_UI_STUB && 'expoInternalSizeFromChildren' in ancestor.props) {
      return false;
    }
  }
  return false;
}

/**
 * Lists the React Native views placed inside a SwiftUI tree. An iPhone would not display them: a
 * text or a view put in a `GroupedList` shows on Android and in the other tests, and leaves a
 * hole on iOS. Use after `renderOnIOS`. Empty when the tree is sound.
 */
export function reactNativeViewsInsideSwiftUI(root: RenderedElement = screen.container): string[] {
  return withDescendants(root)
    .filter((element) => element.type !== EXPO_UI_STUB && isInsideSwiftUI(element))
    .map((element) => `React Native ${element.type} inside SwiftUI`);
}
