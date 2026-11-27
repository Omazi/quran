/**
 * Symbols of the home screen. Outline symbols sit beside text, filled ones stand alone in a tile
 * (sf-symbols.md › Design variants). Each comes with its Material equivalent for Android and the
 * web.
 */

import type { GardenElementKind } from '@/domain/garden';
import type { IconSymbol } from '@/ui';

export const HOME_SYMBOLS = {
  /** The streak (accueil.png): a filled flame while it runs, an outline at zero (soif.png). */
  flame: { ios: 'flame.fill', android: 'local_fire_department' },
  flameOff: { ios: 'flame', android: 'local_fire_department' },
  /** The hizb count, and the dry earth's reassurance (mort.png). */
  leaf: { ios: 'leaf.fill', android: 'eco' },
  /** Water: the main button, the ring of the day, "Arrosé depuis". */
  drop: { ios: 'drop.fill', android: 'water_drop' },
  /** The person, before an account gives an initial. */
  person: { ios: 'person.fill', android: 'person' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
} as const satisfies Record<string, IconSymbol>;

const TREE: IconSymbol = { ios: 'tree.fill', android: 'park' };
const FLOWER: IconSymbol = { ios: 'camera.macro', android: 'local_florist' };
const BIRD: IconSymbol = { ios: 'bird.fill', android: 'flutter_dash' };
const BUILT: IconSymbol = { ios: 'building.columns.fill', android: 'account_balance' };
const LIGHT: IconSymbol = { ios: 'lightbulb.fill', android: 'lightbulb' };
const STONE: IconSymbol = { ios: 'square.grid.2x2.fill', android: 'grid_view' };

/** The symbol of each element of the garden, in the tile of nouveau.png and of "Ajouté au hizb". */
export const ELEMENT_SYMBOLS: Readonly<Record<GardenElementKind, IconSymbol>> = {
  pomegranate: TREE,
  'date-palm': TREE,
  olive: TREE,
  fig: TREE,
  cypress: TREE,
  orange: TREE,
  channels: HOME_SYMBOLS.drop,
  paving: STONE,
  bed: FLOWER,
  'stepping-stones': STONE,
  flowers: FLOWER,
  fountain: HOME_SYMBOLS.drop,
  springs: HOME_SYMBOLS.drop,
  birds: BIRD,
  wall: BUILT,
  trellis: HOME_SYMBOLS.leaf,
  gate: BUILT,
  lanterns: LIGHT,
  butterflies: HOME_SYMBOLS.leaf,
  pavilion: BUILT,
  carpets: STONE,
  cushions: STONE,
  lectern: BUILT,
  roses: FLOWER,
  waterfall: HOME_SYMBOLS.drop,
  'full-bloom': FLOWER,
};

/**
 * The top of the home garden steps aside while the camera glides to the plant (maquette-wow,
 * `growOnReturn`): out in 260 ms, back in 420 ms, rising 10 points (animate skill: under 300 ms
 * out; the return, after the camera, a little slower).
 */
export const HOME_MOTION = { topOutMs: 260, topInMs: 420, topShift: 10 } as const;
