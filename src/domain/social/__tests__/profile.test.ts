import { applyProfileChanges, createProfile } from '../index';
import {
  day,
  expectRefusal,
  IMPOSSIBLE_DAY,
  NOT_TEXT,
  OMAR,
  TODAY,
} from '../test-support/social-test-kit';

describe('Profile (section 2, rule 1)', () => {
  it('a new profile shows the garden and the level by default (D23)', () => {
    expect(createProfile(OMAR, '  Omar ', TODAY)).toEqual({
      id: OMAR,
      displayName: 'Omar',
      showGarden: true,
      showLevel: true,
      gender: null,
      createdOn: TODAY,
    });
  });

  it('a new profile with a bad name is refused with the reason of rule 1', () => {
    expectRefusal(() => createProfile(OMAR, '', TODAY), 'name-empty');
    expectRefusal(() => createProfile(OMAR, 'a'.repeat(31), TODAY), 'name-too-long');
    expectRefusal(() => createProfile(OMAR, 'Om\u0000ar', TODAY), 'name-forbidden-character');
  });

  it('refuses an empty identifier and an impossible day', () => {
    expect(() => createProfile('', 'Omar', TODAY)).toThrow(RangeError);
    expect(() => createProfile(OMAR, 'Omar', IMPOSSIBLE_DAY)).toThrow(RangeError);
  });

  describe('changes', () => {
    const profile = createProfile(OMAR, 'Omar', day('2026-10-01'));

    it('a missing field stays as it is', () => {
      expect(applyProfileChanges(profile, {})).toEqual(profile);
      expect(applyProfileChanges(profile, { showGarden: false })).toEqual({
        ...profile,
        showGarden: false,
      });
      expect(applyProfileChanges(profile, { showLevel: false })).toEqual({
        ...profile,
        showLevel: false,
      });
    });

    it('the gender is changed to male or female, or back to unspecified with null', () => {
      const female = applyProfileChanges(profile, { gender: 'female' });
      expect(female.gender).toBe('female');
      expect(applyProfileChanges(female, { gender: 'male' }).gender).toBe('male');
      expect(applyProfileChanges(female, { gender: null }).gender).toBeNull();
      // Changing the gender touches nothing else.
      expect(applyProfileChanges(female, { gender: null })).toEqual(profile);
    });

    it('a gender that is not male, female or null is refused, so that nothing is guessed', () => {
      expect(() => applyProfileChanges(profile, { gender: 'other' as unknown as 'male' })).toThrow(
        RangeError,
      );
      expect(() => applyProfileChanges(profile, { gender: 1 as unknown as 'male' })).toThrow(
        TypeError,
      );
      // Present but undefined is not "no change" (like every other field).
      expect(() => applyProfileChanges(profile, { gender: undefined })).toThrow(TypeError);
    });

    it('a new name is checked like any display name and trimmed', () => {
      expect(applyProfileChanges(profile, { displayName: ' Abu Omar ' }).displayName).toBe(
        'Abu Omar',
      );
      expectRefusal(() => applyProfileChanges(profile, { displayName: '' }), 'name-empty');
    });

    it('a setting that is not a boolean is a TypeError, not a guess', () => {
      expect(() =>
        applyProfileChanges(profile, { showGarden: 'no' as unknown as boolean }),
      ).toThrow(TypeError);
      expect(() => applyProfileChanges(profile, { displayName: NOT_TEXT })).toThrow(TypeError);
    });

    it('a field that is present but undefined is refused, so that nothing changes by accident', () => {
      expect(() => applyProfileChanges(profile, { showGarden: undefined })).toThrow(TypeError);
    });

    it('the identifier and the creation day cannot be changed', () => {
      const sneaky = { id: 'someone-else', createdOn: TODAY } as unknown as Parameters<
        typeof applyProfileChanges
      >[1];

      expect(() => applyProfileChanges(profile, sneaky)).toThrow(RangeError);
    });
  });
});
