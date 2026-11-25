import {
  SWIPE_PAGING,
  crossfade,
  draggedPosition,
  settledPage,
  stageLayerOpacity,
  swapOpacity,
} from '../components/swipe-paging';

const WIDTH = 400;

describe('a page follows the finger', () => {
  it('moves one page for a drag across the whole width, towards the next page in left to right', () => {
    expect(
      draggedPosition({
        anchor: 3,
        translation: -WIDTH / 2,
        width: WIDTH,
        isRightToLeft: false,
        pageCount: 10,
      }),
    ).toBeCloseTo(3.5);
  });

  it('turns the other way in right to left: a drag to the right shows the next page', () => {
    expect(
      draggedPosition({
        anchor: 3,
        translation: WIDTH / 4,
        width: WIDTH,
        isRightToLeft: true,
        pageCount: 10,
      }),
    ).toBeCloseTo(3.25);
  });

  it('never passes the neighbouring page in one gesture: one gesture, one page', () => {
    const position = draggedPosition({
      anchor: 3,
      translation: -WIDTH * 3,
      width: WIDTH,
      isRightToLeft: false,
      pageCount: 10,
    });
    expect(position).toBe(4);
  });

  it('picks a page up where it is when the finger catches it mid-flight', () => {
    // The pager was sliding from page 3 to page 4 and had reached 3.6 when the finger came down.
    const position = draggedPosition({
      anchor: 4,
      start: 3.6,
      translation: -WIDTH / 10,
      width: WIDTH,
      isRightToLeft: false,
      pageCount: 10,
    });
    expect(position).toBeCloseTo(3.7);
  });

  it('resists past the first and the last page instead of stopping dead', () => {
    const beforeFirst = draggedPosition({
      anchor: 0,
      translation: WIDTH / 2,
      width: WIDTH,
      isRightToLeft: false,
      pageCount: 10,
    });
    expect(beforeFirst).toBeCloseTo(-0.5 * SWIPE_PAGING.edgeResistance);
    const afterLast = draggedPosition({
      anchor: 9,
      translation: -WIDTH / 2,
      width: WIDTH,
      isRightToLeft: false,
      pageCount: 10,
    });
    expect(afterLast).toBeCloseTo(9 + 0.5 * SWIPE_PAGING.edgeResistance);
  });

  it('refuses a pager without width or without pages', () => {
    const drag = { anchor: 0, translation: 10, isRightToLeft: false };
    expect(() => draggedPosition({ ...drag, width: 0, pageCount: 3 })).toThrow(RangeError);
    expect(() => draggedPosition({ ...drag, width: WIDTH, pageCount: 0 })).toThrow(RangeError);
  });
});

describe('the page the pager settles on when the finger lifts', () => {
  const release = { anchor: 4, width: WIDTH, isRightToLeft: false, pageCount: 10 };

  it('goes to the next page past the distance threshold, and comes back short of it', () => {
    const past = SWIPE_PAGING.distanceShare + 0.01;
    const short = SWIPE_PAGING.distanceShare - 0.01;
    expect(settledPage({ ...release, position: 4 + past, velocity: 0 })).toBe(5);
    expect(settledPage({ ...release, position: 4 - past, velocity: 0 })).toBe(3);
    expect(settledPage({ ...release, position: 4 + short, velocity: 0 })).toBe(4);
  });

  it('turns the page on a quick flick, however short', () => {
    const flick = SWIPE_PAGING.flickVelocity + 1;
    expect(settledPage({ ...release, position: 4.02, velocity: -flick })).toBe(5);
    expect(settledPage({ ...release, position: 3.98, velocity: flick })).toBe(3);
  });

  it('follows the flick when it goes against the distance: the last move wins', () => {
    const flick = SWIPE_PAGING.flickVelocity + 1;
    expect(settledPage({ ...release, position: 4.3, velocity: flick })).toBe(3);
  });

  it('reads a flick the other way in right to left', () => {
    const flick = SWIPE_PAGING.flickVelocity + 1;
    expect(settledPage({ ...release, isRightToLeft: true, position: 4, velocity: flick })).toBe(5);
  });

  it('stays on the first and on the last page', () => {
    const flick = SWIPE_PAGING.flickVelocity + 1;
    expect(settledPage({ ...release, anchor: 0, position: -0.1, velocity: flick })).toBe(0);
    expect(settledPage({ ...release, anchor: 9, position: 9.1, velocity: -flick })).toBe(9);
  });
});

describe('what fades as the pages pass', () => {
  it('mixes the value of two pages along the way, smoothly at both ends', () => {
    const values = [0, 1, 1, 0.4];
    expect(crossfade(values, 0)).toBe(0);
    expect(crossfade(values, 0.5)).toBeCloseTo(0.5);
    expect(crossfade(values, 0.1)).toBeLessThan(0.1);
    expect(crossfade(values, 1)).toBe(1);
    expect(crossfade(values, 2.5)).toBeCloseTo(0.7);
    // Past the ends, the value of the end page.
    expect(crossfade(values, -0.3)).toBe(0);
    expect(crossfade(values, 3.2)).toBeCloseTo(0.4);
  });

  it('lays a garden over the one before, so the earth never shows through between two gardens', () => {
    // Pages 0 and 1 show gardens (layers 0 and 1); page 2 shows a picture of another kind.
    const stage = { pageLayers: [0, 1, 2], pageIsGarden: [true, true, false] };
    const at = (layer: number, position: number) =>
      stageLayerOpacity({ ...stage, layer, position });
    // Halfway between two gardens, both are fully drawn: the new one over the old.
    expect(at(0, 0.5)).toBe(1);
    expect(at(1, 0.5)).toBe(1);
    expect(at(0, 0.75)).toBeLessThan(1);
    expect(at(1, 0.25)).toBeLessThan(1);
    // Between a garden and another picture, a plain crossfade.
    expect(at(1, 1.5) + at(2, 1.5)).toBeCloseTo(1);
    expect(at(0, 1.5)).toBe(0);
  });

  it('keeps one layer at full strength when two pages show the same picture', () => {
    const stage = { pageLayers: [0, 0, -1], pageIsGarden: [true, true, false] };
    expect(stageLayerOpacity({ ...stage, layer: 0, position: 0.4 })).toBe(1);
    // A page without a picture lets the one before fade out.
    expect(stageLayerOpacity({ ...stage, layer: 0, position: 2 })).toBe(0);
  });
});

describe('a label that changes from one page to the next', () => {
  it('fades out over the first half of the way and the next one in over the second', () => {
    expect(swapOpacity({ page: 2, pageCount: 5, position: 2 })).toBe(1);
    expect(swapOpacity({ page: 2, pageCount: 5, position: 2.5 })).toBeCloseTo(0);
    expect(swapOpacity({ page: 3, pageCount: 5, position: 2.5 })).toBeCloseTo(0);
    expect(swapOpacity({ page: 3, pageCount: 5, position: 2.25 })).toBe(0);
    expect(swapOpacity({ page: 3, pageCount: 5, position: 2.9 })).toBeGreaterThan(0.5);
    expect(swapOpacity({ page: 3, pageCount: 5, position: 3 })).toBe(1);
  });

  it('is gone when the pages around it are elsewhere, and whole at the ends', () => {
    expect(swapOpacity({ page: 0, pageCount: 5, position: 3 })).toBe(0);
    expect(swapOpacity({ page: 0, pageCount: 5, position: -0.2 })).toBe(1);
    expect(swapOpacity({ page: 4, pageCount: 5, position: 4.2 })).toBe(1);
  });
});
