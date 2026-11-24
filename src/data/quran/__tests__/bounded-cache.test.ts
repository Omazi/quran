import { BoundedCache } from '../bounded-cache';

describe('BoundedCache — a memory cache that never grows past its capacity', () => {
  it('keeps what it is given while there is room', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
    expect(cache.size).toBe(2);
  });

  it('never holds more entries than its capacity', () => {
    const cache = new BoundedCache<number, number>(3);
    for (let key = 0; key < 100; key += 1) {
      cache.set(key, key);
      expect(cache.size).toBeLessThanOrEqual(3);
    }
    expect(cache.size).toBe(3);
  });

  it('drops the entry used least recently first', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // "a" was just used: "b" is now the oldest.
    cache.set('c', 3);

    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('c')).toBe(true);
  });

  it('writing a key again refreshes it without growing the cache', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    cache.set('c', 3);

    expect(cache.get('a')).toBe(10);
    expect(cache.has('b')).toBe(false);
    expect(cache.size).toBe(2);
  });

  it('with a capacity of 1 it only remembers the last entry', () => {
    const cache = new BoundedCache<string, number>(1);
    cache.set('a', 1);
    cache.set('b', 2);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('forgets a deleted entry', () => {
    const cache = new BoundedCache<string, number>(2);
    cache.set('a', 1);
    cache.delete('a');
    cache.delete('never set');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses a capacity of %p',
    (capacity) => {
      expect(() => new BoundedCache<string, number>(capacity)).toThrow(RangeError);
    },
  );
});
