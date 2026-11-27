import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

/** One of the two appearances of the charter. */
export type Appearance = 'light' | 'dark';

const AppearanceOverride = createContext<Appearance | null>(null);

export interface ColorAppearanceProps {
  /** The appearance every colour below takes, whatever the device's; null follows the device. */
  appearance: Appearance | null;
  children: ReactNode;
}

/**
 * Gives a part of the screen one appearance whatever the device's: the reader's night page at
 * night while the phone is in its light appearance (owner's decision of 27 November 2026,
 * SKILLS.md). Everything below it that takes its colours from `useColors`, `useColorValues`,
 * `useBackdropGradient` or `useElevation`, and the SwiftUI controls, takes that appearance. The
 * contrast still follows the device. Elsewhere the app keeps the device's appearance
 * (dark-mode.md › Best practices).
 */
export function ColorAppearance({ appearance, children }: ColorAppearanceProps) {
  return <AppearanceOverride.Provider value={appearance}>{children}</AppearanceOverride.Provider>;
}

/** The appearance fixed by a `ColorAppearance` above, or null. */
export function useAppearanceOverride(): Appearance | null {
  return useContext(AppearanceOverride);
}

/** The appearance the colours take here: the one fixed above, or the device's. */
export function useAppearance(): Appearance {
  const override = useAppearanceOverride();
  const scheme = useColorScheme();
  return override ?? (scheme === 'dark' ? 'dark' : 'light');
}
