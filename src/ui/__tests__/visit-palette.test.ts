import { renderHook } from '@testing-library/react-native';
import { contrastRatio } from '../test-support/contrast';
import { resetDeviceConditions, setDeviceConditions } from '../test-support/environment';
import { contrastThresholds, MINIMUM_FONT_SIZE } from '../tokens';
import {
  useVisitColors,
  visitColors,
  visitTextStyles,
  type VisitColorRole,
} from '../visit-palette';

afterEach(resetDeviceConditions);

type Pair = readonly [foreground: VisitColorRole, background: VisitColorRole];

/** Every text the Proches tab draws, on every surface it draws it on. */
const TEXT_ON_SURFACE: readonly Pair[] = [
  ['title', 'skyTop'],
  ['title', 'page'],
  ['ink', 'card'],
  ['ink', 'skyTop'],
  ['inkSecondary', 'card'],
  ['inkSecondary', 'skyTop'],
  ['inkSecondary', 'skyMiddle'],
  ['inkSecondary', 'skyBottom'],
  ['inkSecondary', 'page'],
  ['inkSecondary', 'field'],
  ['ink', 'field'],
  ['onForest', 'forest'],
  ['onForestSoft', 'forestSoft'],
  ['forestText', 'card'],
  ['forestText', 'page'],
  ['onAppleButton', 'appleButton'],
  ['destructive', 'card'],
];

describe('the palette of the validated mockups', () => {
  it.each(['light', 'dark'] as const)(
    'keeps every text at 4.5:1 or more on its surface (%s)',
    (appearance) => {
      const failures = TEXT_ON_SURFACE.filter(
        ([text, surface]) =>
          contrastRatio(visitColors[text][appearance], visitColors[surface][appearance]) <
          contrastThresholds.text,
      );
      expect(failures).toEqual([]);
    },
  );

  it('keeps the mockup colours that were measured on the pictures', () => {
    expect(visitColors.skyTop.light).toBe('#FBE3C6');
    expect(visitColors.forest.light).toBe('#1F5C45');
    expect(visitColors.forestSoft.light).toBe('#E6EFE9');
    expect(visitColors.avatarViolet.light).toBe('#7C5CD6');
  });

  it('never goes below the smallest text size', () => {
    for (const style of Object.values(visitTextStyles)) {
      expect(style.fontSize).toBeGreaterThanOrEqual(MINIMUM_FONT_SIZE);
    }
  });

  it('follows the appearance of the device', async () => {
    setDeviceConditions({ scheme: 'dark' });
    expect((await renderHook(() => useVisitColors())).result.current.card).toBe(
      visitColors.card.dark,
    );
    setDeviceConditions({ scheme: 'light' });
    expect((await renderHook(() => useVisitColors())).result.current.card).toBe(
      visitColors.card.light,
    );
  });
});
