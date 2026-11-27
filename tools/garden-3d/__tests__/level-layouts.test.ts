/**
 * The gardens of levels 2 to 7 (tools/garden-3d/levels/make_levels.py, D46): each has the 60 steps
 * of the garden catalogue, in its order, so that the app's words for a step stay true of the
 * garden on screen, and every step shows something (except the birds and butterflies, which no
 * pack has, as in level 1).
 */
import { GARDEN_CATALOG } from '@/domain/garden';
import { GARDEN_STYLES } from '@/domain/levels';

interface Layout {
  version: number;
  level: number;
  style: string;
  plot: { half: number; shape: string };
  light?: unknown;
  catalogue: { hizb: number; id: string; kind: string; label: string }[];
  neutral: { element: string | null; kind: string; water?: boolean }[];
  items: { element: string | null; role: string; x?: number; z?: number; y?: number }[];
}

// The project compiles without Node's type definitions: the two functions needed are typed here
// (as src/features/garden/garden3d/test-support/shipped-model.ts).
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: 'utf8') => string;
}>('node:fs');
const { resolve } = jest.requireActual<{ resolve: (...segments: string[]) => string }>('node:path');

const LEVELS = [2, 3, 4, 5, 6, 7];
const read = <T>(level: number, file: string): T =>
  JSON.parse(
    readFileSync(
      resolve(expect.getState().testPath ?? '', '../../source', `level-${level}`, file),
      'utf8',
    ),
  ) as T;
const NO_MODEL = new Set(['birds', 'butterflies']);

describe.each(LEVELS)('the garden of level %i', (level) => {
  const layout = read<Layout>(level, 'layout.json');
  const pack = read<{ roles: Record<string, unknown[] | null> }>(level, 'pack.json');

  it('is the style of its level', () => {
    expect(layout.version).toBe(2);
    expect(layout.level).toBe(level);
    expect(layout.style).toBe(GARDEN_STYLES[level - 1]);
  });

  it('has the 60 steps of the catalogue, one per hizb, in its order, with the same ids and kinds', () => {
    expect(layout.catalogue).toHaveLength(60);
    expect(layout.catalogue.map(({ hizb, id, kind }) => ({ hizb, id, kind }))).toEqual(
      GARDEN_CATALOG.map(({ hizb, id, kind }) => ({ hizb, id, kind })),
    );
    for (const step of layout.catalogue) expect(step.label.length).toBeGreaterThan(0);
  });

  it('starts with water: the first step lays water that dries in a drought', () => {
    const first = layout.catalogue[0]?.id;
    expect(layout.neutral.some((s) => s.element === first && s.water === true)).toBe(true);
  });

  it('shows something at every step that a pack can draw', () => {
    const drawn = new Set([
      ...layout.items.map((i) => i.element),
      ...layout.neutral.map((s) => s.element),
    ]);
    for (const step of layout.catalogue) {
      expect({ step: step.id, drawn: drawn.has(step.id) }).toEqual({
        step: step.id,
        drawn: !NO_MODEL.has(step.kind),
      });
    }
  });

  it('draws its 30 trees with trees (a trunk and leaves, for growth and drought)', () => {
    const trees = layout.catalogue.filter((s) => s.id.startsWith('tree-')).map((s) => s.id);
    expect(trees).toHaveLength(30);
    for (const id of trees) {
      const items = layout.items.filter((i) => i.element === id);
      expect(items).toHaveLength(1);
      expect(items[0]?.role).toMatch(/^tree\./);
    }
  });

  it('gives a model to every role it places, and keeps everything on the plot', () => {
    for (const item of layout.items) {
      expect({ role: item.role, models: (pack.roles[item.role] ?? []).length > 0 }).toEqual({
        role: item.role,
        models: true,
      });
      if (item.x !== undefined && item.z !== undefined) {
        const reach =
          layout.plot.shape === 'round'
            ? Math.hypot(item.x, item.z)
            : Math.max(Math.abs(item.x), Math.abs(item.z));
        expect(reach).toBeLessThanOrEqual(layout.plot.half);
      }
    }
  });

  it('has a light of its own only at night', () => {
    expect(layout.light !== undefined).toBe(layout.style === 'night-garden');
  });
});
