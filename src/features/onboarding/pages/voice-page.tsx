import { useTranslation } from 'react-i18next';

import { ScenePageLayout } from './page-layouts';
import type { OnboardingPageProps } from './page-props';

/**
 * The page about reading aloud. NOT A VALIDATED DESIGN (docs/specs/ui-lot1.md, A.3): it is kept
 * plain, a named placeholder and two lines of text, until its design has been explored. Replace
 * this file to change it; the pager and the other pages do not depend on it.
 */
export function VoicePage({ page, renderScene, bottomInset }: OnboardingPageProps) {
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
