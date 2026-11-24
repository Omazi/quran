import { contrastRatio } from '../test-support/contrast';
import {
  appColors,
  appleTextStyles,
  contrastThresholds,
  fallbackSystemColors,
  fontFamily,
  iosSystemColorNames,
  layout,
  MINIMUM_FONT_SIZE,
  radius,
  spacing,
  textStyles,
  touchTargets,
  type ColorPair,
  type TextStyleName,
} from '../tokens';

// The project compiles without Node's type definitions: the two functions needed are typed here.
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

/** The design charter, which this file checks the tokens against. */
const charter = readFileSync(
  resolve(expect.getState().testPath ?? '', '../../../../docs/design/brand-spec.md'),
  'utf8',
);

type Appearance = keyof ColorPair;
type Usage = keyof typeof contrastThresholds;

interface CharterContrast {
  name: string;
  foreground: string;
  background: string;
  /** The ratio as the charter writes it. */
  written: number;
  usage: Usage;
}

/** The surfaces the charter measures against: white, #F2F2F7, black and #1C1C1E. */
const surface = fallbackSystemColors.background;
const groupedSurface = fallbackSystemColors.secondaryBackground;

/** Every contrast ratio written in the colour table of the charter, in reading order. */
const CHARTER_CONTRASTS: readonly CharterContrast[] = [
  {
    name: 'accent on white',
    foreground: appColors.accent.light,
    background: surface.light,
    written: 6.19,
    usage: 'text',
  },
  {
    name: 'accent on the light grouped background',
    foreground: appColors.accent.light,
    background: groupedSurface.light,
    written: 5.55,
    usage: 'text',
  },
  {
    name: 'white label on accent',
    foreground: appColors.onAccent.light,
    background: appColors.accent.light,
    written: 6.19,
    usage: 'text',
  },
  {
    name: 'dark accent on black',
    foreground: appColors.accent.dark,
    background: surface.dark,
    written: 10.69,
    usage: 'text',
  },
  {
    name: 'dark accent on the dark grouped background',
    foreground: appColors.accent.dark,
    background: groupedSurface.dark,
    written: 8.66,
    usage: 'text',
  },
  {
    name: 'black label on dark accent',
    foreground: appColors.onAccent.dark,
    background: appColors.accent.dark,
    written: 10.69,
    usage: 'text',
  },
  {
    name: 'growth on white',
    foreground: appColors.growth.light,
    background: surface.light,
    written: 6.44,
    usage: 'text',
  },
  {
    name: 'dark growth on black',
    foreground: appColors.growth.dark,
    background: surface.dark,
    written: 10.13,
    usage: 'text',
  },
  {
    name: 'ink on paper',
    foreground: appColors.ink.light,
    background: appColors.paper.light,
    written: 15.89,
    usage: 'text',
  },
  {
    name: 'dark ink on dark paper',
    foreground: appColors.ink.dark,
    background: appColors.paper.dark,
    written: 14.38,
    usage: 'text',
  },
  {
    name: 'ornament on paper',
    foreground: appColors.ornament.light,
    background: appColors.paper.light,
    written: 5.04,
    usage: 'largeTextAndGraphics',
  },
  {
    name: 'dark ornament on dark paper',
    foreground: appColors.ornament.dark,
    background: appColors.paper.dark,
    written: 7.8,
    usage: 'largeTextAndGraphics',
  },
];

/** The rows of the charter's colour table: they start with a role name in backticks. */
const charterColorRows = charter.split('\n').filter((line) => line.startsWith('| `'));

function roundToCharterPrecision(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

describe('colours of the charter', () => {
  it('finds the colour table of the charter', () => {
    expect(charterColorRows).toHaveLength(4);
  });

  it('recomputes every contrast ratio the charter writes, and no other', () => {
    const writtenInCharter = charterColorRows
      .flatMap((row) => [...row.matchAll(/(\d+,\d+):1/g)])
      .map((match) => Number(match[1]?.replace(',', '.')));
    expect(CHARTER_CONTRASTS.map(({ written }) => written)).toEqual(writtenInCharter);
  });

  it.each(CHARTER_CONTRASTS)('$name is $written:1 as written', (contrast) => {
    const ratio = contrastRatio(contrast.foreground, contrast.background);
    expect(roundToCharterPrecision(ratio)).toBe(contrast.written);
  });

  it.each(CHARTER_CONTRASTS)('$name meets the minimum for its use', (contrast) => {
    const ratio = contrastRatio(contrast.foreground, contrast.background);
    expect(ratio).toBeGreaterThanOrEqual(contrastThresholds[contrast.usage]);
  });

  it('uses the thresholds of Apple and WCAG AA', () => {
    expect(contrastThresholds).toEqual({ text: 4.5, largeTextAndGraphics: 3 });
  });

  it.each(Object.entries(appColors))('%s has the values of the charter', (_role, pair) => {
    const table = charterColorRows.join('\n');
    // The label drawn on the accent is written in words in the charter: white, then black.
    if (pair === appColors.onAccent) {
      expect(pair).toEqual({ light: '#FFFFFF', dark: '#000000' });
      return;
    }
    expect(table).toContain(`\`${pair.light}\``);
    expect(table).toContain(`\`${pair.dark}\``);
  });
});

describe('system colours', () => {
  it('names a dynamic system colour for every role on iOS, never a value', () => {
    for (const name of Object.values(iosSystemColorNames)) {
      expect(name).toMatch(/^[a-z][A-Za-z]+$/);
    }
  });

  it('gives every system role an equivalent outside iOS', () => {
    expect(Object.keys(fallbackSystemColors).sort()).toEqual(
      Object.keys(iosSystemColorNames).sort(),
    );
  });

  const appearances: readonly Appearance[] = ['light', 'dark'];
  const backgrounds = [
    'background',
    'secondaryBackground',
    'groupedBackground',
    'secondaryGroupedBackground',
  ] as const;
  const fallbackColors = { ...fallbackSystemColors, ...appColors };

  describe.each(appearances)('fallback palette, %s', (appearance) => {
    describe.each(backgrounds)('on %s', (background) => {
      const backgroundColor = fallbackSystemColors[background][appearance];

      it.each(['label', 'secondaryLabel', 'accent', 'growth'] as const)(
        '%s is readable as text',
        (role) => {
          const ratio = contrastRatio(fallbackColors[role][appearance], backgroundColor);
          expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.text);
        },
      );

      it.each(['warning', 'destructive'] as const)(
        '%s is visible as a graphic or as bold text',
        (role) => {
          const ratio = contrastRatio(fallbackColors[role][appearance], backgroundColor);
          expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.largeTextAndGraphics);
        },
      );
    });
  });
});

describe('text styles', () => {
  /** How the charter names each style in its typography table. */
  const CHARTER_NAMES: Record<TextStyleName, string> = {
    largeTitle: 'Large Title',
    title2: 'Title 2',
    headline: 'Headline',
    body: 'Body',
    subhead: 'Subhead',
    footnote: 'Footnote',
  };
  const names = Object.keys(textStyles) as TextStyleName[];

  it.each(names)('%s has the size and leading of the charter', (name) => {
    const row = new RegExp(`\\| ${CHARTER_NAMES[name]} +\\| (\\d+) / (\\d+)`).exec(charter);
    expect(row).not.toBeNull();
    expect(textStyles[name].fontSize).toBe(Number(row?.[1]));
    expect(textStyles[name].lineHeight).toBe(Number(row?.[2]));
  });

  it('keeps the weights of the charter: bold titles, semibold headline, regular text', () => {
    expect(names.map((name) => textStyles[name].fontWeight)).toEqual([
      '700',
      '700',
      '600',
      '400',
      '400',
      '400',
    ]);
  });

  it('sets the two titles in the system serif and the rest in the system font', () => {
    expect(textStyles.largeTitle.fontFamily).toBe(fontFamily.serif);
    expect(textStyles.title2.fontFamily).toBe(fontFamily.serif);
    for (const name of ['headline', 'body', 'subhead', 'footnote'] as const) {
      expect(textStyles[name]).not.toHaveProperty('fontFamily');
    }
  });

  it('asks iOS for New York by its system design, not by a bundled font', () => {
    expect(fontFamily.serif).toBe('ui-serif');
  });

  it('never goes below the smallest legible size', () => {
    expect(MINIMUM_FONT_SIZE).toBe(11);
    for (const name of names) {
      expect(textStyles[name].fontSize).toBeGreaterThanOrEqual(MINIMUM_FONT_SIZE);
    }
  });

  it("maps every style to Apple's Dynamic Type style of the same name", () => {
    expect(appleTextStyles).toEqual({
      largeTitle: 'largeTitle',
      title2: 'title2',
      headline: 'headline',
      body: 'body',
      subhead: 'subheadline',
      footnote: 'footnote',
    });
  });
});

describe('spacing, shapes and targets', () => {
  it('follows the 8-point grid of the charter', () => {
    expect(spacing).toEqual({ none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
  });

  it('has the three radii of the charter', () => {
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16 });
  });

  it('keeps 16 points at the screen edge and 12 between controls', () => {
    expect(layout.screenMargin).toBe(16);
    expect(layout.controlGap).toBe(12);
  });

  it('asks for 44-point targets on iOS and 48 on Android', () => {
    expect(touchTargets).toEqual({ ios: 44, android: 48, default: 44 });
    expect(layout.touchTarget).toBe(44);
  });
});
