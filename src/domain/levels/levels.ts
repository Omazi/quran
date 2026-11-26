import { FIRST_LEVEL, GARDEN_STYLES } from './config';
import type { GardenStyleId } from './types';

function isWholeFrom(value: number, min: number): boolean {
  return Number.isSafeInteger(value) && value >= min;
}

/** The level of the garden grown by the `khatm`-th khatma: its number, capped at the last style. */
export function levelOfKhatma(khatm: number): number {
  if (!isWholeFrom(khatm, 1)) {
    throw new RangeError(`Levels: a khatma is a whole number from 1, got ${khatm}`);
  }
  return Math.min(khatm, GARDEN_STYLES.length);
}

/** A person's level from the number of khatmas they completed: the next khatma's level. */
export function levelOfCompletedKhatmas(completed: number): number {
  if (!isWholeFrom(completed, 0)) {
    throw new RangeError(`Levels: completed khatmas are a whole number from 0, got ${completed}`);
  }
  return levelOfKhatma(completed + 1);
}

/** The garden style of a level, from 1 to the number of styles. */
export function styleOfLevel(level: number): GardenStyleId {
  const style = isWholeFrom(level, FIRST_LEVEL) ? GARDEN_STYLES[level - 1] : undefined;
  if (style === undefined) {
    throw new RangeError(
      `Levels: a level is a whole number from 1 to ${GARDEN_STYLES.length}, got ${level}`,
    );
  }
  return style;
}
