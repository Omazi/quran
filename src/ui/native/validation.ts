/**
 * Checks shared by both implementations of the native controls. An invalid value is a
 * programming error: it is reported, never silently corrected (docs/CONTRIBUTING.md).
 */

import type { PageIndicatorProps, StepperRowProps, TimeOfDay } from './types';

const LAST_HOUR = 23;
const LAST_MINUTE = 59;

/** New Year's Day, far from the daylight-saving changes that make some times of day not exist. */
const REFERENCE_YEAR = 2001;
const REFERENCE_MONTH_INDEX = 0;
const REFERENCE_DAY = 1;

/** Progress and gauge values are fractions of the whole. */
export function assertFraction(value: number, name: string): void {
  if (!(value >= 0 && value <= 1)) {
    throw new RangeError(`${name} must be between 0 and 1, received ${value}.`);
  }
}

/** The system stepper counts in whole numbers. */
export function assertStepperRange({
  value,
  min,
  max,
  step = 1,
}: Pick<StepperRowProps, 'value' | 'min' | 'max' | 'step'>): void {
  if (![value, min, max, step].every(Number.isInteger)) {
    throw new TypeError('A stepper needs whole numbers for value, min, max and step.');
  }
  if (step < 1) throw new RangeError(`step must be at least 1, received ${step}.`);
  if (min > max) throw new RangeError(`min (${min}) must not exceed max (${max}).`);
  if (value < min || value > max) {
    throw new RangeError(`value must be between ${min} and ${max}, received ${value}.`);
  }
}

export function assertTimeOfDay({ hour, minute }: TimeOfDay): void {
  if (!Number.isInteger(hour) || hour < 0 || hour > LAST_HOUR) {
    throw new RangeError(`hour must be a whole number from 0 to ${LAST_HOUR}, received ${hour}.`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > LAST_MINUTE) {
    throw new RangeError(
      `minute must be a whole number from 0 to ${LAST_MINUTE}, received ${minute}.`,
    );
  }
}

export function assertPagePosition({ count, index }: Pick<PageIndicatorProps, 'count' | 'index'>) {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a whole number of at least 1, received ${count}.`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError(`index must be a whole number from 0 to ${count - 1}, received ${index}.`);
  }
}

/** The system pickers work with dates: a time of day becomes that time on the reference day. */
export function timeOfDayToDate(time: TimeOfDay): Date {
  assertTimeOfDay(time);
  return new Date(REFERENCE_YEAR, REFERENCE_MONTH_INDEX, REFERENCE_DAY, time.hour, time.minute);
}

export function dateToTimeOfDay(date: Date): TimeOfDay {
  return { hour: date.getHours(), minute: date.getMinutes() };
}
