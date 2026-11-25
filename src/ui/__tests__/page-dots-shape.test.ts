import { PAGE_DOTS, pageDotShape } from '../components/page-dots-shape';

describe('the dots of the page control', () => {
  it('draws the current page as a longer dot', () => {
    expect(pageDotShape(0)).toEqual({
      width: PAGE_DOTS.currentWidth,
      height: PAGE_DOTS.dot,
      spacing: PAGE_DOTS.gap,
      emphasis: 1,
    });
  });

  it('draws its two neighbours on each side at full size', () => {
    for (const distance of [1, 2]) {
      expect(pageDotShape(distance)).toEqual({
        width: PAGE_DOTS.dot,
        height: PAGE_DOTS.dot,
        spacing: PAGE_DOTS.gap,
        emphasis: 0,
      });
    }
  });

  it('shrinks the dots further away, then hides them, as the system control does', () => {
    expect(pageDotShape(3).width).toBe(PAGE_DOTS.smallDot);
    expect(pageDotShape(4).width).toBe(PAGE_DOTS.smallerDot);
    expect(pageDotShape(5)).toEqual({ width: 0, height: 0, spacing: 0, emphasis: 0 });
    expect(pageDotShape(12)).toEqual({ width: 0, height: 0, spacing: 0, emphasis: 0 });
  });

  it('changes shape continuously as the pages pass, the same on both sides', () => {
    const halfway = pageDotShape(0.5);
    expect(halfway.width).toBeCloseTo((PAGE_DOTS.currentWidth + PAGE_DOTS.dot) / 2);
    expect(halfway.emphasis).toBeCloseTo(0.5);
    expect(pageDotShape(-3.5)).toEqual(pageDotShape(3.5));
  });
});
