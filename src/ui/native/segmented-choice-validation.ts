import type { SegmentedChoiceProps } from './types';

/** A segmented control has two segments or more (segmented-controls.md, first sentence). */
const MINIMUM_SEGMENTS = 2;

/**
 * Checks shared by both implementations of `SegmentedChoice`. A choice with a single option, or
 * whose value is none of its options, would show no selected segment: it is a programming error.
 */
export function assertSegmentedChoice<Value extends string>({
  options,
  value,
}: Pick<SegmentedChoiceProps<Value>, 'options' | 'value'>): void {
  if (options.length < MINIMUM_SEGMENTS) {
    throw new RangeError(
      `A segmented choice needs at least ${MINIMUM_SEGMENTS} options, received ${options.length}.`,
    );
  }
  if (!options.some((option) => option.value === value)) {
    throw new RangeError(`The value "${value}" is not one of the options of the segmented choice.`);
  }
}
