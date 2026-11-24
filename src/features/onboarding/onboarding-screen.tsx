import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';

import { Pager, Screen, type ScreenBackground } from '@/ui';

import type { OnboardingPageKind } from './pages';
import { GoalPage } from './pages/goal-page';
import type { OnboardingPageProps } from './pages/page-props';
import { RemindersPage } from './pages/reminders-page';
import { StoryPage } from './pages/story-page';
import { VoicePage } from './pages/voice-page';
import { renderPlaceholderScene, type SceneRenderer } from './scene';
import type { OnboardingActions, OnboardingModel } from './use-onboarding';

/** The component of each kind of page. A page is replaced here, and only here. */
const PAGE_COMPONENTS: Readonly<Record<OnboardingPageKind, ComponentType<OnboardingPageProps>>> = {
  story: StoryPage,
  voice: VoicePage,
  goal: GoalPage,
  reminders: RemindersPage,
};

/** A page that shows a grouped list sits on the grouped background (color.md › Mobile). */
const PAGE_BACKGROUNDS: Readonly<Record<OnboardingPageKind, ScreenBackground>> = {
  story: 'background',
  voice: 'background',
  goal: 'groupedBackground',
  reminders: 'groupedBackground',
};

export interface OnboardingScreenProps {
  model: OnboardingModel;
  actions: OnboardingActions;
  /** Draws the scene of a page. Defaults to a named placeholder. */
  renderScene?: SceneRenderer;
}

/**
 * The first-launch flow: the pages of the model in the system pager, one swipe for one page,
 * with its page indicator. There is no "Continue" and no "Skip" button (owner's decision,
 * deviation 3 of docs/design/SKILLS.md); the last page ends the flow.
 *
 * This component is the whole pager. It knows neither how many pages there are nor what they
 * say: the list is data (pages.ts) and each kind of page is its own component.
 */
export function OnboardingScreen({
  model,
  actions,
  renderScene = renderPlaceholderScene,
}: OnboardingScreenProps) {
  const { t } = useTranslation('onboarding');
  const { pages, pageIndex } = model;
  const shownPage = pages[pageIndex];
  if (shownPage === undefined) {
    throw new RangeError(`There is no page ${pageIndex} in a flow of ${pages.length} pages.`);
  }
  return (
    <Screen background={PAGE_BACKGROUNDS[shownPage.kind]} testID="onboarding">
      <Pager
        pageCount={pages.length}
        page={pageIndex}
        onPageChange={actions.showPage}
        accessibilityLabel={t('pager.label')}
        accessibilityValue={t('pager.position', { page: pageIndex + 1, total: pages.length })}
        testID="onboarding-pager"
        renderPage={(index) => {
          const page = pages[index];
          if (page === undefined) return null;
          const Page = PAGE_COMPONENTS[page.kind];
          return <Page page={page} model={model} actions={actions} renderScene={renderScene} />;
        }}
      />
    </Screen>
  );
}
