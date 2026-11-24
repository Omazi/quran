/**
 * A cache that never holds more than `capacity` entries. When it is full, the entry used
 * least recently is dropped first.
 */
export class BoundedCache<Key, Value> {
  // A Map remembers insertion order: the first key is always the least recently used.
  private readonly entries = new Map<Key, Value>();

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(
        `Invalid cache capacity: ${capacity} (expected a whole number, at least 1)`,
      );
    }
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: Key): boolean {
    return this.entries.has(key);
  }

  /** Returns the value and marks it as just used. */
  get(key: Key): Value | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: Key, value: Value): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.capacity) {
      const leastRecentlyUsed = this.entries.keys().next();
      if (!leastRecentlyUsed.done) this.entries.delete(leastRecentlyUsed.value);
    }
  }

  delete(key: Key): void {
    this.entries.delete(key);
  }
}
