/**
 * The one palette of the app (tokens `palette`, D39): every text on every surface it is drawn on,
 * one value per role, and the plain values for what cannot take a dynamic colour.
 */
import { renderHook, waitFor } from '@testing-library/react-native';
import { DynamicColorIOS } from 'react-native';

import { contrastRatio } from '../test-support/contrast';
import { resetDeviceConditions, setDeviceConditions } from '../test-support/environment';
import { appColors, contrastThresholds, palette, type PaletteRole } from '../tokens';
import { useColors, useColorValues } from '../use-colors';

afterEach(resetDeviceConditions);

const APPEARANCES = ['light', 'dark'] as const;

type Role = PaletteRole | keyof typeof appColors;

function valueOf(role: Role, appearance: 'light' | 'dark'): string {
  return role in palette
    ? palette[role as PaletteRole][appearance]
    : appColors[role as keyof typeof appColors][appearance];
}

/** Every text of the tabs, the reader and the voice-following view, on its surfaces. */
const TEXT_ON_SURFACE: readonly (readonly [Role, Role])[] = [
  ['heading', 'canvas'],
  ['heading', 'skyTop'],
  ['heading', 'surface'],
  ['muted', 'canvas'],
  ['muted', 'skyTop'],
  ['muted', 'surface'],
  ['muted', 'field'],
  ['muted', 'surfaceInset'],
  ['actionTint', 'surface'],
  ['actionTint', 'canvas'],
  ['actionTint', 'actionTonal'],
  ['onAction', 'action'],
  ['onContrastButton', 'contrastButton'],
  ['destructiveText', 'surface'],
  ['water', 'surface'],
  ['ink', 'pageGround'],
  ['ink', 'canvas'],
  ['ink', 'surface'],
  ['ink', 'surfaceInset'],
  ['inkSecondary', 'pageGround'],
  ['inkSecondary', 'canvas'],
  ['inkSecondary', 'surface'],
  ['inkSecondary', 'surfaceInset'],
  ['accent', 'canvas'],
  ['accent', 'surface'],
  ['ornament', 'surface'],
  ['ornament', 'surfaceInset'],
  ['heading', 'surface'],
  ['followRereadInk', 'followRereadBack'],
  ['onFollowBar', 'followBarStart'],
  ['onFollowBarSecondary', 'followBarStart'],
  ['onFollowBarSecondary', 'followBarEnd'],
];

describe('the palette', () => {
  it.each(APPEARANCES)('keeps every text at 4.5:1 or more on its surface (%s)', (appearance) => {
    const failures = TEXT_ON_SURFACE.filter(
      ([text, surface]) =>
        contrastRatio(valueOf(text, appearance), valueOf(surface, appearance)) <
        contrastThresholds.text,
    ).map(([text, surface]) => `${text} on ${surface}`);
    expect(failures).toEqual([]);
  });

  it.each(APPEARANCES)('keeps the symbol on the listening bar at 3:1 (%s)', (appearance) => {
    expect(
      contrastRatio(valueOf('onFollowBar', appearance), valueOf('followBarEnd', appearance)),
    ).toBeGreaterThanOrEqual(contrastThresholds.largeTextAndGraphics);
  });

  it('keeps the mockup colours that were measured on the pictures', () => {
    expect(palette.skyTop.light).toBe('#FBE3C6');
    expect(palette.canvas.light).toBe('#F3F1EC');
    expect(palette.pageGround.light).toBe('#F3EFE4');
    expect(palette.action.light).toBe('#1F5C45');
    expect(palette.actionTonal.light).toBe('#E6EFE9');
    expect(palette.waterFill.light).toBe('#3FA7B5');
    expect(palette.avatarViolet.light).toBe('#7C5CD6');
    expect(palette.surfaceInset.light).toBe(appColors.paper.light);
  });

  it('has one forest green for every filled button, by day and at night', () => {
    // The capsule, the reader's microphone and the system's prominent button share `action`.
    expect(palette.action).toEqual({ light: '#1F5C45', dark: '#2E7A5B' });
    expect(palette.onAction).toEqual({ light: '#FFFFFF', dark: '#FFFFFF' });
  });

  it.each(APPEARANCES)('sets the cards apart from the grounds (%s)', (appearance) => {
    expect(palette.surface[appearance]).not.toBe(palette.canvas[appearance]);
    expect(palette.surface[appearance]).not.toBe(palette.pageGround[appearance]);
  });
});

describe('useColorValues', () => {
  it.each(APPEARANCES)('gives the plain values of the device appearance (%s)', async (scheme) => {
    setDeviceConditions({ scheme });
    const { result } = await renderHook(() => useColorValues());
    expect(result.current.surface).toBe(palette.surface[scheme]);
    expect(result.current.goldDeep).toBe(palette.goldDeep[scheme]);
    expect(result.current.ink).toBe(appColors.ink[scheme]);
  });

  it('gives the high-contrast value where the palette has one', async () => {
    setDeviceConditions({ os: 'android', scheme: 'light', highContrast: true });
    const { result } = await renderHook(() => useColorValues());
    await waitFor(() => {
      expect(result.current.muted).not.toBe(palette.muted.light);
    });
  });
});

describe('useColors on iOS', () => {
  it('gives every palette role as a dynamic colour', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useColors());
    expect(result.current.frameOuter).toEqual(DynamicColorIOS(palette.frameOuter));
  });
});
