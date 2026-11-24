/**
 * Run-time checks for values TypeScript believes well typed, but that can arrive broken
 * from storage or JSON.
 *
 * They return a plain boolean on purpose. Used directly as type guards, `Array.isArray`
 * and `instanceof Set` would turn a `readonly T[]` into `any[]` and a `ReadonlySet<T>`
 * into `Set<any>`: the code after the check would no longer be type-checked.
 */

export function isList(value: unknown): boolean {
  return Array.isArray(value);
}

export function isSet(value: unknown): boolean {
  return value instanceof Set;
}

export function isObject(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}
