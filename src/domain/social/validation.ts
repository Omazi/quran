import { isLocalDate, type LocalDate } from '@/domain/shared/local-date';

import { MAX_ID_LENGTH } from './config';

/**
 * Guards of the module. The types cannot be trusted at run time: rows come back from a server
 * or from memory, identifiers from links and forms. A value of the wrong shape is named here
 * with an explicit error; nothing is silently corrected (docs/CONTRIBUTING.md).
 */

/** Visible ASCII characters only: no space, no control character, nothing that looks alike. */
const ID_PATTERN = /^[!-~]+$/;

function describeKind(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

/** A plain boolean on purpose: used as a type guard, `Array.isArray` would lose `readonly`. */
export function isList(value: unknown): boolean {
  return Array.isArray(value);
}

export function assertObject(value: unknown, label: string): void {
  if (typeof value !== 'object' || value === null || isList(value)) {
    throw new TypeError(`Invalid ${label}: expected an object, got ${describeKind(value)}`);
  }
}

export function assertList(value: unknown, label: string): void {
  if (!isList(value)) {
    throw new TypeError(`Invalid ${label}: expected a list, got ${describeKind(value)}`);
  }
}

/** An identifier of an account or of a group: 1 to 64 visible ASCII characters. */
export function assertId(id: string, label: string): void {
  if (typeof id !== 'string') {
    throw new TypeError(`Invalid ${label}: expected an identifier, got ${describeKind(id)}`);
  }
  if (id.length > MAX_ID_LENGTH || !ID_PATTERN.test(id)) {
    throw new RangeError(
      `Invalid ${label}: expected 1 to ${MAX_ID_LENGTH} visible ASCII characters`,
    );
  }
}

/**
 * A LocalDate is a branded string: the brand can be forged by a cast or by data from a
 * server, so the value itself is checked, starting with its type.
 */
export function assertLocalDate(date: LocalDate, label: string): void {
  if (typeof date !== 'string' || !isLocalDate(date)) {
    throw new RangeError(`Invalid ${label}: "${String(date)}" (expected a real YYYY-MM-DD date)`);
  }
}
