import type { Gender } from '@/domain/shared/gender';

/**
 * What the person picks when asked: a man, a woman, or "prefer not to say". The third is a
 * choice of its own (the person was asked and answered), stored as `null`.
 */
export type GenderChoice = Gender | 'unspecified';

export const GENDER_CHOICES: readonly GenderChoice[] = ['male', 'female', 'unspecified'];

export function choiceOfGender(gender: Gender | null): GenderChoice {
  return gender ?? 'unspecified';
}

export function genderOfChoice(choice: GenderChoice): Gender | null {
  return choice === 'unspecified' ? null : choice;
}
