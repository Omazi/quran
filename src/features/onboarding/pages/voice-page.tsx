import { useTranslation } from 'react-i18next';

import { StoryWordsLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The page about reading aloud, after the listening: its words here, its picture (the real page
 * and bar of the following, voix.png) on the stage (`VoiceScene`). Replace this file to change
 * it; the pager and the other pages do not depend on it.
 */
export function VoicePage({ page }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return <StoryWordsLayout title={t(page.title)} text={t(page.text)} words={page.words} />;
}
