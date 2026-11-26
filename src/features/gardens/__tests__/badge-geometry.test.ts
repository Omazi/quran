import { progressArc, STAR_INNER_RATIO, starPoints } from '../badge-geometry';

function corners(points: string): [number, number][] {
  return points.split(' ').map((pair) => pair.split(',').map(Number) as [number, number]);
}

describe('the eight-pointed star of the badge', () => {
  it('has sixteen corners, its first point at the top', () => {
    const list = corners(starPoints(50, 40));
    expect(list).toHaveLength(16);
    expect(list[0]).toEqual([50, 10]);
  });

  it('puts its eight points on one circle and its eight inner corners on a smaller one', () => {
    const list = corners(starPoints(50, 40));
    list.forEach(([x, y], index) => {
      const distance = Math.hypot(x - 50, y - 50);
      expect(distance).toBeCloseTo(index % 2 === 0 ? 40 : 40 * STAR_INNER_RATIO, 1);
    });
  });

  it('is the outline of two equal squares turned 45° from each other', () => {
    // A corner of the upright square is a point of the star: at 45°, on the circle.
    const list = corners(starPoints(50, 40));
    const upright = list[6]!;
    expect(upright[0] - 50).toBeCloseTo(upright[1] - 50, 1);
    expect(upright[0] - 50).toBeCloseTo(40 / Math.SQRT2, 1);
    expect(STAR_INNER_RATIO).toBeCloseTo(0.765, 3);
  });
});

describe('the progress arc of a garden in its badge', () => {
  it('draws nothing at 0, and starts at the top', () => {
    expect(progressArc(50, 30, 0)).toBe('M 50 20');
  });

  it('ends at the right for a quarter and at the bottom for a half, clockwise', () => {
    expect(progressArc(50, 30, 0.25)).toBe('M 50 20 A 30 30 0 0 1 80 50');
    expect(progressArc(50, 30, 0.5)).toBe('M 50 20 A 30 30 0 0 1 50 80');
    expect(progressArc(50, 30, 0.75)).toBe('M 50 20 A 30 30 0 1 1 20 50');
  });

  it('closes the circle in two halves at 1', () => {
    expect(progressArc(50, 30, 1)).toBe('M 50 20 A 30 30 0 1 1 50 80 A 30 30 0 1 1 50 20');
  });

  it('refuses a fraction outside 0 to 1', () => {
    expect(() => progressArc(50, 30, 1.2)).toThrow(RangeError);
    expect(() => progressArc(50, 30, Number.NaN)).toThrow(RangeError);
  });
});
