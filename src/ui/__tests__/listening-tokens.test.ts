import { listeningPalette, listeningShape, type ListeningPaletteRole } from '../listening-tokens';
import { contrastThresholds } from '../tokens';
import { contrastRatio } from '../test-support/contrast';

/**
 * Every text of the listening screens on its background, by day and at night
 * (accessibility.md › Vision: 4.5:1 for text up to 17 points, 3:1 for larger or bold text and
 * for symbols).
 */
const TEXT_PAIRS: readonly [ListeningPaletteRole, ListeningPaletteRole][] = [
  ['onScene', 'sceneTop'],
  ['onScene', 'sceneMiddle'],
  ['onSceneSecondary', 'sceneMiddle'],
  ['cardTitle', 'card'],
  ['cardSecondary', 'card'],
  ['cardAccent', 'card'],
  ['cardAccent', 'cardTint'],
  ['onCardAction', 'cardAction'],
  ['followRereadInk', 'followRereadBack'],
  ['onFollowBar', 'followBarStart'],
  ['onFollowBarSecondary', 'followBarStart'],
  ['onFollowBarSecondary', 'followBarEnd'],
];

const SYMBOL_PAIRS: readonly [ListeningPaletteRole, ListeningPaletteRole][] = [
  ['onOrb', 'orbBody'],
  ['onOrb', 'orbEdge'],
];

describe('the colours of the listening screens', () => {
  it.each(TEXT_PAIRS.flatMap((pair) => (['light', 'dark'] as const).map((a) => [...pair, a])))(
    '%s on %s (%s) reaches 4.5:1',
    (foreground, background, appearance) => {
      const ratio = contrastRatio(
        listeningPalette[foreground as ListeningPaletteRole][appearance as 'light'],
        listeningPalette[background as ListeningPaletteRole][appearance as 'light'],
      );
      expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.text);
    },
  );

  it.each(SYMBOL_PAIRS.flatMap((pair) => (['light', 'dark'] as const).map((a) => [...pair, a])))(
    'the symbol %s on %s (%s) reaches 3:1',
    (foreground, background, appearance) => {
      const ratio = contrastRatio(
        listeningPalette[foreground as ListeningPaletteRole][appearance as 'light'],
        listeningPalette[background as ListeningPaletteRole][appearance as 'light'],
      );
      expect(ratio).toBeGreaterThanOrEqual(contrastThresholds.largeTextAndGraphics);
    },
  );

  it('gives every colour a day and a night value', () => {
    for (const pair of Object.values(listeningPalette)) {
      expect(pair.light).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
      expect(pair.dark).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/);
    }
  });
});

describe('the shapes of the listening screens', () => {
  it('keeps every control at 44 points or more', () => {
    expect(listeningShape.sceneButtonHit).toBeGreaterThanOrEqual(44);
    expect(listeningShape.cardButtonHeight).toBeGreaterThanOrEqual(44);
    expect(listeningShape.orbDiameter).toBeGreaterThanOrEqual(44);
    expect(listeningShape.followStopDiameter).toBeGreaterThanOrEqual(44);
  });

  it('draws the rings outside the microphone, growing outwards', () => {
    const radii = listeningShape.ringRadii;
    expect(radii[0]).toBeGreaterThan(listeningShape.orbDiameter / 2);
    expect([...radii].sort((a, b) => a - b)).toEqual([...radii]);
  });
});
