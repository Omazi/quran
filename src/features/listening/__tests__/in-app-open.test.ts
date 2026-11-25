import { forgetOpenedInApp, markOpenedInApp, wasOpenedInApp } from '../in-app-open';

beforeEach(forgetOpenedInApp);

describe('the mark of an in-app opening', () => {
  it('is absent by default: a link carries none', () => {
    expect(wasOpenedInApp('listening')).toBe(false);
    expect(wasOpenedInApp('reader-follow')).toBe(false);
  });

  it('holds for its route only, and runs out', () => {
    markOpenedInApp('listening', 1_000);
    expect(wasOpenedInApp('listening', 1_500)).toBe(true);
    expect(wasOpenedInApp('reader-follow', 1_500)).toBe(false);
    expect(wasOpenedInApp('listening', 7_000)).toBe(false);
  });
});
