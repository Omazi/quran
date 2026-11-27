import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { Gender } from '@/domain/shared/gender';
import { genderContext } from '@/i18n';
import { useOptionalAppStore } from '@/store';

/**
 * What the person says they are, or null (not said, or "prefer not to say"). Null as well when
 * there is no store around the screen: a text is then in its neutral wording, never a guess.
 */
export function useMyGender(): Gender | null {
  return useOptionalAppStore((state) => state.settings.gender, null);
}

type Namespace = string;

/**
 * `useTranslation`, for the texts that speak to the person: unless a call gives its own
 * `context`, the person's gender is the context, so `key_female` is what a woman reads where a
 * language needs another form ("اقرأ" / "اقرئي", "arrêté" / "arrêtée"), and the plain key is
 * what everyone else reads. A text that speaks of someone else gives its own `context` (the
 * gender of that person, `undefined` when they have not said), which then wins.
 */
export function useGenderedTranslation(namespace: Namespace) {
  const { t, i18n } = useTranslation(namespace);
  const context = genderContext(useMyGender());
  const genderedT = useCallback(
    (key: string, options?: Record<string, unknown>) =>
      typeof options === 'object' || options === undefined
        ? t(key, { context, ...options })
        : t(key, options),
    [t, context],
  );
  // The cast gives back the type of `t`, which the callers already use (`TFunction<'friends'>`
  // in their helpers): this function takes a key and the same options, and only adds a context.
  return { t: genderedT as unknown as typeof t, i18n };
}
