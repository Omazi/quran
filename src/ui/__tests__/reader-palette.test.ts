/**
 * The palette of the validated mockups for the reader and the Quran tab (tokens `readerPalette`,
 * SKILLS.md deviation 80): resolved per appearance like the charter's colours, and the text roles
 * the reader draws on its surfaces stay readable on each of them (accessibility.md › Vision;
 * dark-mode.md › Dark Mode colors: at least 4.5:1).
 */

import { renderHook } from '@testing-library/react-native';
import { DynamicColorIOS } from 'react-native';

import { contrastRatio } from '../test-support/contrast';
import { resetDeviceConditions, setDeviceConditions } from '../test-support/environment';
import { appColors, contrastThresholds, readerPalette, type ReaderPaletteRole } from '../tokens';
import { useReaderPalette } from '../use-colors';

afterEach(resetDeviceConditions);

const APPEARANCES = ['light', 'dark'] as const;
const ROLES = Object.keys(readerPalette) as ReaderPaletteRole[];

describe('useReaderPalette', () => {
  it.each(APPEARANCES)(
    'gives Android and the web the value of the appearance: %s',
    async (scheme) => {
      setDeviceConditions({ os: 'android', scheme });
      const { result } = await renderHook(() => useReaderPalette());
      for (const role of ROLES) expect(result.current[role]).toBe(readerPalette[role][scheme]);
    },
  );

  it('gives iOS dynamic colours, which follow the appearance without a render', async () => {
    setDeviceConditions({ os: 'ios' });
    const { result } = await renderHook(() => useReaderPalette());
    for (const role of ROLES) {
      expect(result.current[role]).toEqual(DynamicColorIOS(readerPalette[role]));
    }
  });

  it('keeps the mockup values measured on the validated PNGs', () => {
    expect(readerPalette.canvas.light).toBe('#F3EFE4');
    expect(readerPalette.cardCream.light).toBe(appColors.paper.light);
    expect(readerPalette.ring.light).toBe('#3FA7B5');
  });
});

describe('text on the surfaces of the mockups', () => {
  const surfaces = ['canvas', 'card', 'cardCream'] as const;
  const texts = ['ink', 'inkSecondary', 'accent', 'ornament'] as const;
  const cases = APPEARANCES.flatMap((appearance) =>
    surfaces.flatMap((surface) => texts.map((text) => ({ appearance, surface, text }))),
  );

  it.each(cases)(
    '$text on $surface ($appearance) reaches 4.5:1',
    ({ appearance, surface, text }) => {
      const ratio = contrastRatio(appColors[text][appearance], readerPalette[surface][appearance]);
      expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.text);
    },
  );

  it.each(APPEARANCES)(
    'the round buttons and cards stand apart from the ground (%s)',
    (appearance) => {
      expect(readerPalette.card[appearance]).not.toBe(readerPalette.canvas[appearance]);
    },
  );
});
