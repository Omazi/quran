import { BREADCRUMB_CAPACITY, createBreadcrumbs } from '../breadcrumbs';

describe('the trail of breadcrumbs', () => {
  it('keeps what happened, oldest first, with the time it happened', () => {
    let time = 1000;
    const trail = createBreadcrumbs(() => time);
    trail.add('nav', '/onboarding');
    time = 2500;
    trail.add('gesture', 'pager-pan');
    expect(trail.snapshot()).toEqual([
      { at: 1000, kind: 'nav', label: '/onboarding' },
      { at: 2500, kind: 'gesture', label: 'pager-pan' },
    ]);
  });

  it('is a ring: only the last 30 stay, and the oldest ones go first', () => {
    expect(BREADCRUMB_CAPACITY).toBe(30);
    const trail = createBreadcrumbs(() => 0);
    for (let index = 0; index < 75; index += 1) trail.add('nav', `page-${index}`);
    const kept = trail.snapshot();
    expect(kept).toHaveLength(30);
    expect(kept[0]?.label).toBe('page-45');
    expect(kept[29]?.label).toBe('page-74');
  });

  it('hands out a copy: what a record keeps does not change afterwards', () => {
    const trail = createBreadcrumbs(() => 0);
    trail.add('nav', 'a');
    const before = trail.snapshot();
    trail.add('nav', 'b');
    expect(before).toHaveLength(1);
  });

  it('cuts a long label and never throws on a strange one', () => {
    const trail = createBreadcrumbs(() => 0);
    trail.add('nav', 'x'.repeat(500));
    expect(trail.snapshot()[0]?.label.length).toBeLessThanOrEqual(120);
    expect(() => trail.add('nav', undefined as unknown as string)).not.toThrow();
  });

  it('can be emptied', () => {
    const trail = createBreadcrumbs(() => 0);
    trail.add('nav', 'a');
    trail.clear();
    expect(trail.snapshot()).toEqual([]);
  });
});
