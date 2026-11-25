import { arabicIndicDigits } from '../arabic-digits';

describe('arabicIndicDigits', () => {
  it('writes a whole number in the digits of the printed mushaf', () => {
    expect(arabicIndicDigits(110)).toBe('١١٠');
    expect(arabicIndicDigits(7)).toBe('٧');
    expect(arabicIndicDigits(286)).toBe('٢٨٦');
    expect(arabicIndicDigits(0)).toBe('٠');
  });

  it('refuses what is not a whole number from 0', () => {
    expect(() => arabicIndicDigits(-1)).toThrow(RangeError);
    expect(() => arabicIndicDigits(2.5)).toThrow(RangeError);
    expect(() => arabicIndicDigits(Number.NaN)).toThrow(RangeError);
  });
});
