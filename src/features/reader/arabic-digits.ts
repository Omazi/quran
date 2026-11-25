const ARABIC_INDIC_ZERO = 0x0660;
const WESTERN_DIGIT = /[0-9]/g;

/**
 * A whole number in Arabic-Indic digits (٠ to ٩), as the printed mushaf writes the verse count
 * of a surah in its cartouche ("آياتها ١١٠"). The digits are computed, never copied.
 */
export function arabicIndicDigits(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`Only a whole number from 0 is written in digits, not ${value}.`);
  }
  return String(value).replace(WESTERN_DIGIT, (digit) =>
    String.fromCharCode(ARABIC_INDIC_ZERO + Number(digit)),
  );
}
