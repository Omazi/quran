import { useTranslation } from 'react-i18next';

import { ScenePageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * A page of the story: the scene of the garden, which changes at each page, a title and one
 * sentence. The scene is the one thing meant to be looked at; the rest stays quiet.
 */
export function StoryPage({ page, renderScene, bottomInset }: OnboardingPageProps) {
  const { t } = useTranslation('onboarding');
  return (
    <ScenePageLayout
      scene={page.scene === null ? null : renderScene(page.scene)}
      title={t(page.title)}
      text={t(page.text)}
      bottomInset={bottomInset}
    />
  );
}
