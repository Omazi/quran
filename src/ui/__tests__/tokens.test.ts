import { contrastRatio } from '../test-support/contrast';
import {
  appColors,
  appleTextStyles,
  contrastThresholds,
  fallbackSystemColors,
  fontFamily,
  highContrastAppColors,
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
/** The charter has two colour tables: the standard values, then the high-contrast ones. */
type CharterTable = 'standard' | 'highContrast';

interface CharterContrast {
  table: CharterTable;
  name: string;
  foreground: string;
  background: string;
  /** The ratio as the charter writes it. */
  written: number;
  usage: Usage;
}

const APPEARANCES: readonly Appearance[] = ['light', 'dark'];

/** The surfaces the charter measures against: white, #F2F2F7, black and #1C1C1E. */
const surface = fallbackSystemColors.background;
const groupedSurface = fallbackSystemColors.secondaryBackground;

/** Every contrast ratio written in the two colour tables of the charter, in reading order. */
const CHARTER_CONTRASTS: readonly CharterContrast[] = [
  {
    table: 'standard',
    name: 'accent on white',
    foreground: appColors.accent.light,
    background: surface.light,
    written: 6.19,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'accent on the light grouped background',
    foreground: appColors.accent.light,
    background: groupedSurface.light,
    written: 5.55,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'white label on accent',
    foreground: appColors.onAccent.light,
    background: appColors.accent.light,
    written: 6.19,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'dark accent on black',
    foreground: appColors.accent.dark,
    background: surface.dark,
    written: 10.69,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'dark accent on the dark grouped background',
    foreground: appColors.accent.dark,
    background: groupedSurface.dark,
    written: 8.66,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'black label on dark accent',
    foreground: appColors.onAccent.dark,
    background: appColors.accent.dark,
    written: 10.69,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'growth on white',
    foreground: appColors.growth.light,
    background: surface.light,
    written: 6.44,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'dark growth on black',
    foreground: appColors.growth.dark,
    background: surface.dark,
    written: 10.13,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'ink on paper',
    foreground: appColors.ink.light,
    background: appColors.paper.light,
    written: 15.89,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'secondary ink on paper',
    foreground: appColors.inkSecondary.light,
    background: appColors.paper.light,
    written: 5.13,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'dark ink on dark paper',
    foreground: appColors.ink.dark,
    background: appColors.paper.dark,
    written: 14.38,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'dark secondary ink on dark paper',
    foreground: appColors.inkSecondary.dark,
    background: appColors.paper.dark,
    written: 6.73,
    usage: 'text',
  },
  {
    table: 'standard',
    name: 'ornament on paper',
    foreground: appColors.ornament.light,
    background: appColors.paper.light,
    written: 5.04,
    usage: 'largeTextAndGraphics',
  },
  {
    table: 'standard',
    name: 'dark ornament on dark paper',
    foreground: appColors.ornament.dark,
    background: appColors.paper.dark,
    written: 7.8,
    usage: 'largeTextAndGraphics',
  },
  {
    table: 'highContrast',
    name: 'high-contrast accent on white',
    foreground: highContrastAppColors.accent.light,
    background: surface.light,
    written: 9.23,
    usage: 'text',
  },
  {
    table: 'highContrast',
    name: 'high-contrast dark accent on black',
    foreground: highContrastAppColors.accent.dark,
    background: surface.dark,
    written: 14.02,
    usage: 'text',
  },
  {
    table: 'highContrast',
    name: 'high-contrast growth on white',
    foreground: highContrastAppColors.growth.light,
    background: surface.light,
    written: 9.52,
    usage: 'text',
  },
  {
    table: 'highContrast',
    name: 'high-contrast dark growth on black',
    foreground: highContrastAppColors.growth.dark,
    background: surface.dark,
    written: 13.49,
    usage: 'text',
  },
  {
    table: 'highContrast',
    name: 'high-contrast ornament on paper',
    foreground: highContrastAppColors.ornament.light,
    background: appColors.paper.light,
    written: 7.78,
    usage: 'largeTextAndGraphics',
  },
  {
    table: 'highContrast',
    name: 'high-contrast dark ornament on dark paper',
    foreground: highContrastAppColors.ornament.dark,
    background: appColors.paper.dark,
    written: 10.44,
    usage: 'largeTextAndGraphics',
  },
];

/** The rows of a colour table of the charter: they start with a role name in backticks. */
function colorTableRows(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('| `'));
}

/** The colour section of the charter; a paragraph that starts with these words opens its second table. */
const colorSection = charter.slice(
  charter.indexOf('### Couleurs'),
  charter.indexOf('### Typographie'),
);
const [standardText = '', highContrastText = ''] = colorSection.split(/^Contraste élevé/m);
const CHARTER_ROWS: Record<CharterTable, string[]> = {
  standard: colorTableRows(standardText),
  highContrast: colorTableRows(highContrastText),
};
const TABLES: readonly CharterTable[] = ['standard', 'highContrast'];
/** Roles the charter writes in a paragraph after the tables (the owner's approval of D27 and D29). */
const ROLES_OUTSIDE_THE_TABLES: ReadonlySet<string> = new Set(['ornamentLine', 'accentStrong']);

function roundToCharterPrecision(ratio: number): number {
  return Math.round(ratio * 100) / 100;
}

/** The surface a role is measured against in the charter: paper for the ornament, else the screen. */
function charterBackground(role: keyof typeof highContrastAppColors, appearance: Appearance) {
  return role === 'ornament' || role === 'ornamentLine'
    ? appColors.paper[appearance]
    : surface[appearance];
}

describe('colours of the charter', () => {
  it('finds both colour tables of the charter, and no third one', () => {
    expect(CHARTER_ROWS.standard).toHaveLength(4);
    expect(CHARTER_ROWS.highContrast).toHaveLength(3);
    expect(colorTableRows(colorSection)).toHaveLength(7);
  });

  it.each(TABLES)('recomputes every contrast ratio of the %s table, and no other', (table) => {
    const writtenInCharter = CHARTER_ROWS[table]
      .flatMap((row) => [...row.matchAll(/(\d+,\d+):1/g)])
      .map((match) => Number(match[1]?.replace(',', '.')));
    const recomputed = CHARTER_CONTRASTS.filter((contrast) => contrast.table === table);
    expect(recomputed.map(({ written }) => written)).toEqual(writtenInCharter);
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

  it.each(Object.entries(appColors).filter(([role]) => !ROLES_OUTSIDE_THE_TABLES.has(role)))(
    '%s has the values of the charter',
    (_role, pair) => {
      const table = CHARTER_ROWS.standard.join('\n');
      // The label drawn on the accent is written in words in the charter: white, then black.
      if (pair === appColors.onAccent) {
        expect(pair).toEqual({ light: '#FFFFFF', dark: '#000000' });
        return;
      }
      expect(table).toContain(`\`${pair.light}\``);
      expect(table).toContain(`\`${pair.dark}\``);
    },
  );

  describe('the two roles the owner approved with the listening screen (D27, D29)', () => {
    const paragraph = colorSection.slice(colorSection.indexOf('Deux rôles de plus'));

    it('writes them in the charter, outside the tables', () => {
      expect(paragraph).toContain('`ornamentLine`');
      expect(paragraph).toContain('`accentStrong`');
      expect(paragraph).toContain(`\`${appColors.ornamentLine.light}\``);
      expect(paragraph).toContain(`\`${appColors.accentStrong.light}\``);
      expect(paragraph).toContain(`\`${appColors.accentStrong.dark}\``);
    });

    it('gives the ornament line the gold of the validated prototype by day', () => {
      expect(appColors.ornamentLine.light).toBe('#CE9A3C');
    });

    it('gives the ornament line the dark ornament at night, and its high-contrast values', () => {
      expect(appColors.ornamentLine.dark).toBe(appColors.ornament.dark);
      expect(highContrastAppColors.ornamentLine).toEqual(highContrastAppColors.ornament);
    });

    it('keeps the ornament line a line: 2.36:1 on paper by day, a decoration with no information', () => {
      const ratio = contrastRatio(appColors.ornamentLine.light, appColors.paper.light);
      expect(roundToCharterPrecision(ratio)).toBe(2.36);
    });

    it('gives the strong water the high-contrast water in both appearances', () => {
      expect(appColors.accentStrong).toEqual(highContrastAppColors.accent);
      expect(highContrastAppColors).not.toHaveProperty('accentStrong');
    });
  });
});

describe('high-contrast colours of the charter', () => {
  const roles = Object.keys(highContrastAppColors) as (keyof typeof highContrastAppColors)[];

  it('has a variant for every role of the high-contrast table, and for no other', () => {
    const rolesInCharter = CHARTER_ROWS.highContrast.map((row) => /^\| `(\w+)`/.exec(row)?.[1]);
    expect(roles.filter((role) => !ROLES_OUTSIDE_THE_TABLES.has(role))).toEqual(rolesInCharter);
  });

  it.each(roles.filter((role) => !ROLES_OUTSIDE_THE_TABLES.has(role)))(
    '%s has the high-contrast values of the charter',
    (role) => {
      const row = CHARTER_ROWS.highContrast.find((line) => line.startsWith(`| \`${role}\``));
      expect(row).toContain(`\`${highContrastAppColors[role].light}\``);
      expect(row).toContain(`\`${highContrastAppColors[role].dark}\``);
    },
  );

  describe.each(APPEARANCES)('%s', (appearance) => {
    it.each(roles)('%s stands out more than its standard value', (role) => {
      const background = charterBackground(role, appearance);
      const standard = contrastRatio(appColors[role][appearance], background);
      const high = contrastRatio(highContrastAppColors[role][appearance], background);
      expect(high).toBeGreaterThan(standard);
    });

    it('keeps the label of the main button readable on the stronger accent', () => {
      const ratio = contrastRatio(
        appColors.onAccent[appearance],
        highContrastAppColors.accent[appearance],
      );
      expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.text);
    });
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

  const backgrounds = [
    'background',
    'secondaryBackground',
    'groupedBackground',
    'secondaryGroupedBackground',
  ] as const;
  const fallbackColors = {
    standard: { ...fallbackSystemColors, ...appColors },
    highContrast: { ...fallbackSystemColors, ...appColors, ...highContrastAppColors },
  };

  describe.each(TABLES)('fallback palette, %s values', (contrast) => {
    describe.each(APPEARANCES)('%s', (appearance) => {
      describe.each(backgrounds)('on %s', (background) => {
        const backgroundColor = fallbackSystemColors[background][appearance];

        it.each(['label', 'secondaryLabel', 'accent', 'growth'] as const)(
          '%s is readable as text',
          (role) => {
            const color = fallbackColors[contrast][role][appearance];
            expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(
              contrastThresholds.text,
            );
          },
        );

        it.each(['warning', 'destructive'] as const)(
          '%s is visible as a graphic or as bold text',
          (role) => {
            const color = fallbackColors[contrast][role][appearance];
            expect(contrastRatio(color, backgroundColor)).toBeGreaterThanOrEqual(
              contrastThresholds.largeTextAndGraphics,
            );
          },
        );
      });
    });
  });
});

describe('text styles', () => {
  /** How the charter names each style in its typography table. */
  const CHARTER_NAMES: Record<TextStyleName, string> = {
    largeTitle: 'Large Title',
    displayTitle: 'Display Title',
    title1: 'Title 1',
    title2: 'Title 2',
    figure: 'Figure',
    title3: 'Title 3',
    headline: 'Headline',
    body: 'Body',
    callout: 'Callout',
    pillTitle: 'Pill Title',
    subhead: 'Subhead',
    subheadEmphasized: 'Subhead Emphasized',
    footnote: 'Footnote',
  };
  const names = Object.keys(textStyles) as TextStyleName[];

  it.each(names)('%s has the size and leading of the charter', (name) => {
    const row = new RegExp(`\\| ${CHARTER_NAMES[name]} +\\| (\\d+) / (\\d+)`).exec(charter);
    expect(row).not.toBeNull();
    expect(textStyles[name].fontSize).toBe(Number(row?.[1]));
    expect(textStyles[name].lineHeight).toBe(Number(row?.[2]));
  });

  it('keeps the weights of the charter: bold titles and figures, regular display title, semibold labels, regular text', () => {
    expect(names.map((name) => [name, textStyles[name].fontWeight])).toEqual([
      // The titles are set in Fraunces SemiBold, the one weight the app ships.
      ['largeTitle', '600'],
      ['displayTitle', '400'],
      ['title1', '600'],
      ['title2', '600'],
      ['figure', '700'],
      ['title3', '700'],
      ['headline', '600'],
      ['body', '400'],
      ['callout', '600'],
      ['pillTitle', '600'],
      ['subhead', '400'],
      ['subheadEmphasized', '600'],
      ['footnote', '400'],
    ]);
  });

  it('sets the titles in Fraunces, the display title in the system serif, the rest in the system font', () => {
    expect(textStyles.largeTitle.fontFamily).toBe(fontFamily.display);
    expect(textStyles.title1.fontFamily).toBe(fontFamily.display);
    expect(textStyles.title2.fontFamily).toBe(fontFamily.display);
    expect(textStyles.pillTitle.fontFamily).toBe(fontFamily.display);
    expect(textStyles.displayTitle.fontFamily).toBe(fontFamily.serif);
    for (const name of [
      'figure',
      'title3',
      'headline',
      'body',
      'callout',
      'subhead',
      'subheadEmphasized',
      'footnote',
    ] as const) {
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
      displayTitle: 'largeTitle',
      title1: 'title1',
      title2: 'title2',
      // A figure of 24 points scales as Title 2 (22 points), the nearest of Apple's styles.
      figure: 'title2',
      title3: 'title3',
      headline: 'headline',
      body: 'body',
      callout: 'callout',
      // The title of a glass pill, 16 points like Callout, scales as Callout.
      pillTitle: 'callout',
      subhead: 'subheadline',
      subheadEmphasized: 'subheadline',
      footnote: 'footnote',
    });
  });
});

describe('spacing, shapes and targets', () => {
  it('follows the 8-point grid of the charter', () => {
    expect(spacing).toEqual({ none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 });
  });

  it('has the three radii of the charter, the card of the mockups and the capsule', () => {
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16, xl: 24, full: 999 });
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
