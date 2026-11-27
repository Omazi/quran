import { centredLine, inkMetrics, type InkMetrics } from '../ink-centre';

// The font files are read with Node's own modules, typed here: the project has no Node types.
interface FontBytes {
  readUInt16BE: (offset: number) => number;
  readUInt32BE: (offset: number) => number;
  readInt16BE: (offset: number) => number;
  toString: (encoding: 'latin1', start: number, end: number) => string;
}
const { readFileSync } = jest.requireActual<{ readFileSync: (path: string) => FontBytes }>(
  'node:fs',
);
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

const FONT_FILES = {
  quranTitle: 'node_modules/@expo-google-fonts/amiri/700Bold/Amiri_700Bold.ttf',
} as const;

/** The ascent and descent of a font file in ems, read from its `hhea` and `head` tables. */
function lineMetricsOf(file: string): { ascent: number; descent: number } {
  const font = readFileSync(resolve(expect.getState().testPath ?? '', '../../../..', file));
  const tables = new Map<string, number>();
  for (let index = 0; index < font.readUInt16BE(4); index += 1) {
    const record = 12 + index * 16;
    tables.set(font.toString('latin1', record, record + 4), font.readUInt32BE(record + 8));
  }
  const unitsPerEm = font.readUInt16BE((tables.get('head') ?? 0) + 18);
  const hhea = tables.get('hhea') ?? 0;
  return {
    ascent: font.readInt16BE(hhea + 4) / unitsPerEm,
    descent: -font.readInt16BE(hhea + 6) / unitsPerEm,
  };
}

/**
 * Where the middle of the band of letters lands in a line, from the top of the line: the model the
 * three platforms share once the line is at least as tall as the font (the font's own box, ascent
 * above the baseline and descent below, sits in the middle of the line).
 */
function bandMiddleInLine(metrics: InkMetrics, fontSize: number, lineHeight: number): number {
  const baseline = lineHeight / 2 + ((metrics.ascent - metrics.descent) / 2) * fontSize;
  return baseline - ((metrics.bandTop - metrics.bandBottom) / 2) * fontSize;
}

describe('the measures of the fonts of framed titles', () => {
  it.each(Object.entries(FONT_FILES))(
    'keeps the ascent and descent of the font file of %s',
    (name, file) => {
      const measured = lineMetricsOf(file);
      const kept = inkMetrics[name as keyof typeof FONT_FILES];
      expect(kept.ascent).toBeCloseTo(measured.ascent, 3);
      expect(kept.descent).toBeCloseTo(measured.descent, 3);
    },
  );

  it('keeps a band of letters inside the font box', () => {
    for (const metrics of Object.values(inkMetrics)) {
      expect(metrics.bandTop).toBeGreaterThan(0);
      expect(metrics.bandTop).toBeLessThan(metrics.ascent);
      expect(metrics.bandBottom).toBeGreaterThan(0);
      expect(metrics.bandBottom).toBeLessThan(metrics.descent);
      // No text of the font is drawn shorter than its band.
      expect(metrics.inkTop).toBeGreaterThanOrEqual(metrics.bandTop);
      expect(metrics.inkBottom).toBeGreaterThanOrEqual(metrics.bandBottom);
    }
  });
});

describe('centredLine', () => {
  const title = inkMetrics.quranTitle;

  it.each([
    [23.8 * 1.2, 47.6],
    [28 * 1.2, 56],
    [33.6 * 1.2, 67.2],
    [46.2 * 1.2, 92.4],
  ])('puts the band of a %f-point title in the middle of its line', (fontSize, asked) => {
    const line = centredLine(title, fontSize, asked);
    expect(bandMiddleInLine(title, fontSize, line.lineHeight) + line.translateY).toBeCloseTo(
      line.lineHeight / 2,
      5,
    );
  });

  it('never gives a line shorter than the font: iOS only centres a line that holds its font', () => {
    // 33.6 points of Amiri are 59.1 points tall (ascent 1.124 + descent 0.634): a 56-point line
    // would be cut at the top on iOS and the title would sit high.
    const line = centredLine(title, 33.6, 56);
    expect(line.lineHeight).toBe(60);
    expect(line.lineHeight).toBeGreaterThanOrEqual((title.ascent + title.descent) * 33.6);
  });

  it.each([20, 28.56, 33.6, 55.44])(
    'holds the tallest and the deepest %f-point text inside the line',
    (fontSize) => {
      const line = centredLine(title, fontSize, 0);
      const baseline = bandMiddleInLine(title, fontSize, line.lineHeight) + line.translateY;
      const lowered = baseline + ((title.bandTop - title.bandBottom) / 2) * fontSize;
      // The hamza of «سورة الأنعام» above, the final mim of «سورة القلم» below.
      expect(lowered - title.inkTop * fontSize).toBeGreaterThanOrEqual(0);
      expect(line.lineHeight - lowered - title.inkBottom * fontSize).toBeGreaterThanOrEqual(0);
      // No taller than a point more than it must be.
      expect(line.lineHeight - 2 * (title.inkBottom + 0.224) * fontSize).toBeLessThan(1);
    },
  );

  it('keeps a line that is already tall enough', () => {
    expect(centredLine(title, 20, 48).lineHeight).toBe(48);
  });

  it('lifts the Amiri title by a fiftieth of its size: its letters sit low in their box', () => {
    const line = centredLine(title, 33.6, 56);
    expect(line.translateY).toBeCloseTo(-0.71, 2);
    expect(centredLine(title, 67.2, 112).translateY).toBeCloseTo(2 * line.translateY, 5);
  });
});
