/**
 * The part of a page that the bars leave visible: a friend's page lays its first screen in it,
 * so that the card rests just above the tab bar and both its buttons show without scrolling
 * (maquettes 2026-11-26, "friend").
 */
import { visibleAreaOf } from '../visible-area';

const IPHONE = { windowHeight: 852, headerHeight: 103, bottomInset: 83 };

describe('visibleAreaOf', () => {
  it('a page under the navigation bar and the tab bar: both are taken off', () => {
    expect(visibleAreaOf({ ...IPHONE, pageTop: 0, pageHeight: 852 })).toEqual({
      top: 103,
      bottom: 83,
      height: 666,
    });
  });

  it('a page that starts below an opaque navigation bar: nothing is taken twice', () => {
    expect(visibleAreaOf({ ...IPHONE, pageTop: 103, pageHeight: 749 })).toEqual({
      top: 0,
      bottom: 83,
      height: 666,
    });
  });

  it('a page that ends above a tab bar laid out beside it (Android, the web): no bottom', () => {
    expect(
      visibleAreaOf({
        windowHeight: 800,
        headerHeight: 56,
        bottomInset: 0,
        pageTop: 56,
        pageHeight: 664,
      }),
    ).toEqual({ top: 0, bottom: 0, height: 664 });
  });

  it('a page not measured yet is taken as the whole window under both bars', () => {
    expect(visibleAreaOf({ ...IPHONE, pageTop: null, pageHeight: null })).toEqual({
      top: 103,
      bottom: 83,
      height: 666,
    });
  });

  it('never gives a negative height', () => {
    expect(
      visibleAreaOf({ ...IPHONE, headerHeight: 200, pageTop: 0, pageHeight: 150 }).height,
    ).toBe(0);
  });
});
