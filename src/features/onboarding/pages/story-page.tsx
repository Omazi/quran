import { useTranslation } from 'react-i18next';

import { StoryWordsLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * A page of the story: its title and its sentence, low on the page. The scene above them is not
 * part of the page: it stays in place while the pages slide, and changes with the finger
 * (`StoryStage`). The first page adds the hint to swipe.
 */
export function StoryPage({ page, model }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  const isFirst = model.pages[0]?.id === page.id;
  return (
    <StoryWordsLayout
      title={t(page.title)}
      text={t(page.text)}
      words={page.words}
      hint={isFirst ? t('hint') : undefined}
    />
  );
}
