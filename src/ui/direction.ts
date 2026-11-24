import { I18nManager } from 'react-native';

export type WritingDirection = 'ltr' | 'rtl';

/**
 * The writing direction of the interface. React Native fixes it at launch (`I18nManager`), and
 * mirrors rows, logical margins and `start`/`end` text alignment by itself; this function is for
 * the few places that must be told, such as the SwiftUI hosts.
 */
export function getWritingDirection(): WritingDirection {
  return I18nManager.isRTL ? 'rtl' : 'ltr';
}
