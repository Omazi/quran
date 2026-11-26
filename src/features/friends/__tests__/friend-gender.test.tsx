/**
 * The words about a friend, and to the person, agree with the gender each one says they have
 * (owner decision of 26 November 2026): "Lire avec lui" / "Lire avec elle", the status of the
 * encouragement, the Arabic "اقرأ معه" / "اقرئي معها", and the neutral wording when it is not said.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DEMO_USERS } from '@/data/social';
import type { Gender } from '@/domain/shared/gender';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import type { AppLanguage } from '@/i18n';
import { AppStoreProvider } from '@/store';
import { createTestAppStore } from '@/store/test-support/test-store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import { FriendPage } from '../friends-pages';
import { signedInDemoForTest, withStore } from '../test-support/demo';

afterEach(resetDeviceConditions);

/** Sarah's page, seen by Omar, with Sarah and Omar saying what the test chooses. */
async function visit({
  language,
  friend,
  viewer,
}: {
  language: AppLanguage;
  friend: Gender | null;
  viewer: Gender | null;
}) {
  await showLanguage(language);
  const { store, demo } = await signedInDemoForTest();
  await demo.repositoryAs(DEMO_USERS.sarah).updateMyProfile({ gender: friend });
  const app = createTestAppStore({ settings: { gender: viewer, genderAsked: true } });
  await render(
    <AppStoreProvider store={app}>
      {withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />)}
    </AppStoreProvider>,
  );
  return screen.findByTestId('friend-read');
}

describe('the button to read with a friend', () => {
  it.each([
    ['fr', 'male', 'Lire avec lui'],
    ['fr', 'female', 'Lire avec elle'],
    ['fr', null, 'Lire avec Sarah'],
    ['en', 'male', 'Read with him'],
    ['en', 'female', 'Read with her'],
    ['en', null, 'Read with Sarah'],
    ['ar', 'male', 'اقرأ معه'],
    ['ar', 'female', 'اقرأ معها'],
    ['ar', null, 'اقرأ مع Sarah'],
  ] as const)('in %s, for a friend who is %s: "%s"', async (language, friend, label) => {
    const button = await visit({ language, friend, viewer: null });

    expect(button).toHaveTextContent(label);
    expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
  });

  it.each([
    ['male', 'male', 'اقرأ معه'],
    ['male', 'female', 'اقرأ معها'],
    ['female', 'male', 'اقرئي معه'],
    ['female', 'female', 'اقرئي معها'],
    ['female', null, 'اقرئي مع Sarah'],
    [null, null, 'اقرأ مع Sarah'],
  ] as const)(
    'in Arabic, the verb follows the person who reads (%s) and the pronoun the friend (%s): "%s"',
    async (viewer, friend, label) => {
      const button = await visit({ language: 'ar', friend, viewer });

      expect(button).toHaveTextContent(label);
    },
  );

  it('does not change in French or English with the gender of the person who reads', async () => {
    const button = await visit({ language: 'fr', friend: 'female', viewer: 'male' });
    expect(button).toHaveTextContent('Lire avec elle');
  });

  it('still opens the friend’s reader, whatever the words', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const openReader = jest.fn();
    await render(
      withStore(
        store,
        <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} openReader={openReader} />,
      ),
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Lire avec elle' }));

    expect(openReader).toHaveBeenCalledTimes(1);
  });
});

describe('the status after an encouragement', () => {
  async function encourage(language: AppLanguage, friend: Gender | null) {
    await visit({ language, friend, viewer: null });
    await fireEvent.press(await screen.findByTestId('friend-encourage'));
    return screen.findByTestId('friend-encourage');
  }

  it.each([
    ['male', 'Encouragé aujourd’hui'],
    ['female', 'Encouragée aujourd’hui'],
    [null, 'Encouragement envoyé'],
  ] as const)('in French, for a friend who is %s: "%s"', async (friend, label) => {
    const done = await encourage('fr', friend);

    expect(done).toHaveTextContent(label);
    expect(done).toBeDisabled();
  });

  it('says it the same way in English, and neutrally in Arabic', async () => {
    expect(await encourage('en', 'female')).toHaveTextContent('Encouraged Today');
    expect(await encourage('ar', 'female')).toHaveTextContent('تمّ التشجيع اليوم');
  });
});

describe('what a friend does not share', () => {
  it.each([
    ['en', 'male', 'His Reading'],
    ['en', 'female', 'Her Reading'],
    ['en', null, 'Their Reading'],
    ['ar', 'male', 'قراءته'],
    ['ar', 'female', 'قراءتها'],
    ['ar', null, 'القراءة'],
    ['fr', 'female', 'Sa lecture'],
  ] as const)(
    'titles the reading card in %s, for a friend who is %s: "%s"',
    async (language, friend, title) => {
      await visit({ language, friend, viewer: null });

      expect(screen.getByText(title)).toBeOnTheScreen();
    },
  );

  it.each([
    ['en', 'male', 'Sarah doesn’t share his level or his reading.'],
    ['en', 'female', 'Sarah doesn’t share her level or her reading.'],
    ['en', null, 'Sarah doesn’t share their level or their reading.'],
    ['ar', 'male', 'لا يشارك Sarah مستواه ولا قراءته.'],
    ['ar', 'female', 'لا تشارك Sarah مستواها ولا قراءتها.'],
    ['ar', null, 'المستوى والقراءة غير مشارَكين لدى Sarah.'],
  ] as const)('says it in %s for a friend who is %s', async (language, friend, sentence) => {
    await showLanguage(language);
    const { store, demo } = await signedInDemoForTest();
    await demo.repositoryAs(DEMO_USERS.sarah).updateMyProfile({ gender: friend, showLevel: false });
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));

    expect(await screen.findByTestId('friend-level-hidden')).toHaveTextContent(sentence);
  });
});

describe('the hint of the button, which speaks to the person who reads', () => {
  it.each([
    ['male', 'Ouvre le Coran où tu t’es arrêté.'],
    ['female', 'Ouvre le Coran où tu t’es arrêtée.'],
    [null, 'Ouvre le Coran là où tu en étais.'],
  ] as const)('in French, for a person who is %s', async (viewer, hint) => {
    const button = await visit({ language: 'fr', friend: 'female', viewer });

    expect(button).toHaveProp('accessibilityHint', hint);
  });
});
