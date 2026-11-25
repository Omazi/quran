import { useTranslation } from 'react-i18next';

import { StoryWordsLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The page about reading aloud. It appears only once that feature ships (`SHIPPED_FEATURES`), and
 * its picture is still a named placeholder: the prototype's lyrics view is to be redrawn from the
 * validated voix.png then. Replace this file to change it; the pager and the other pages do not
 * depend on it.
 */
export function VoicePage({ page }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return <StoryWordsLayout title={t(page.title)} text={t(page.text)} words={page.words} />;
}
