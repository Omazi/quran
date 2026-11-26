import { GENDERS, isGender, parseGender } from '../gender';

describe('Gender (the person says it; nothing guesses it)', () => {
  it('has two values, the two grammatical genders of French and Arabic', () => {
    expect([...GENDERS]).toEqual(['male', 'female']);
  });

  it('isGender accepts exactly those two values', () => {
    expect(isGender('male')).toBe(true);
    expect(isGender('female')).toBe(true);
    for (const other of ['', 'Male', 'other', 'neutral', null, undefined, 1, {}, ['male']]) {
      expect(isGender(other)).toBe(false);
    }
  });

  it('parseGender keeps a value and null as they are', () => {
    expect(parseGender('male')).toBe('male');
    expect(parseGender('female')).toBe('female');
    expect(parseGender(null)).toBeNull();
  });

  it('parseGender refuses anything else, with an explicit error: nothing is corrected in silence', () => {
    expect(() => parseGender('other')).toThrow(RangeError);
    expect(() => parseGender(undefined)).toThrow(TypeError);
    expect(() => parseGender(1)).toThrow(TypeError);
  });
});
