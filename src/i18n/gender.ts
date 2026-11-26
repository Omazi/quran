import type { Gender } from '@/domain/shared/gender';

/**
 * The i18next `context` that picks the wording for a gender. A text that depends on gender has
 * its neutral wording under its own key (said to, or of, someone who has not said what they
 * are) and the other two under `key_male` and `key_female`; i18next falls back to the plain key
 * when a context has no text, so a language that needs no difference writes only the plain key.
 *
 * It is used for two things that must not be mixed up: the gender of the person the app speaks
 * to ("اقرأ" / "اقرئي"), and the gender of the person it speaks of ("Lire avec lui" / "Lire avec
 * elle"). A text that depends on both ("اقرئي معه") takes the second as its context and the
 * first through an interpolated word.
 */
export function genderContext(gender: Gender | null | undefined): Gender | undefined {
  return gender ?? undefined;
}
