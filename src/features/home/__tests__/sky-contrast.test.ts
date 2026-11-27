import { mixHex, skyForAppearance, skyStateAt } from '@/features/garden';
import { glassVeilMinimum } from '@/ui';
import { colorValuesFor } from '@/ui';

import { contrastRatio, skyBehind, veilOpacityFor, type Ink } from '../sky-contrast';
import { chromeOf } from '../use-sky-chrome';

const EVERY_MINUTE = Array.from({ length: 24 * 4 }, (_, k) => k / 4);

/** The colour of the glass over the sky: its tint at its opacity. */
const composite = (behind: string, veil: string, alpha: number) => mixHex(behind, veil, alpha);

describe('the words over the sky are readable at every hour (accessibility.md › Vision)', () => {
  for (const device of ['light', 'dark'] as const) {
    it(`on the panel, every quarter of an hour (device ${device})`, () => {
      for (const hour of EVERY_MINUTE) {
        const sky = skyStateAt(hour);
        const chrome = chromeOf(sky, device);
        const colors = colorValuesFor(chrome.appearance);
        for (const behind of skyBehind(skyForAppearance(sky, device)).panel) {
          const surface = composite(behind, colors.glassVeil, chrome.panelVeil);
          for (const role of ['heading', 'muted', 'water', 'actionTint'] as const) {
            expect(contrastRatio(colors[role], surface)).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });

    it(`for the date and the title on the sky, every quarter of an hour (device ${device})`, () => {
      for (const hour of EVERY_MINUTE) {
        const sky = skyStateAt(hour);
        const chrome = chromeOf(sky, device);
        const colors = colorValuesFor(chrome.appearance);
        for (const behind of skyBehind(skyForAppearance(sky, device)).header) {
          const surface = composite(behind, colors.glassVeil, chrome.headerVeil);
          // The date is written in the title's colour over the sky (use-sky-chrome.ts).
          expect(contrastRatio(colors.heading, surface)).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(colors.heading, surface)).toBeGreaterThanOrEqual(3);
        }
      }
    });
  }

  it('keeps the mockup’s glass, no thicker, when the sky allows it (noon, midnight)', () => {
    expect(chromeOf(skyStateAt(12.5), 'light').panelVeil).toBe(glassVeilMinimum.panel.light);
    expect(chromeOf(skyStateAt(0), 'light').panelVeil).toBe(glassVeilMinimum.panel.dark);
    expect(chromeOf(skyStateAt(12.5), 'light').chipVeil).toBe(glassVeilMinimum.chip.light);
  });

  it('draws no veil behind the title when the sky alone is enough', () => {
    expect(chromeOf(skyStateAt(0), 'light').headerVeil).toBe(0);
  });

  it('takes the night values over a night sky, and in Dark Mode', () => {
    expect(chromeOf(skyStateAt(22.5), 'light').appearance).toBe('dark');
    expect(chromeOf(skyStateAt(13), 'light').appearance).toBe('light');
    expect(chromeOf(skyStateAt(13), 'dark').appearance).toBe('dark');
  });
});

describe('the least opacity of the tint', () => {
  const ink: Ink = { color: '#000000', minimum: 4.5 };

  it('is the least asked when it is already enough', () => {
    expect(veilOpacityFor(['#ffffff'], '#ffffff', [ink], 0.3)).toBe(0.3);
  });

  it('grows until the words read', () => {
    const alpha = veilOpacityFor(['#000000'], '#ffffff', [ink], 0);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it('is 1 when even the tint alone is not enough', () => {
    expect(veilOpacityFor(['#000000'], '#000000', [ink], 0)).toBe(1);
  });

  it('refuses an opacity outside 0 to 1', () => {
    expect(() => veilOpacityFor(['#000000'], '#ffffff', [ink], 2)).toThrow(RangeError);
  });
});
