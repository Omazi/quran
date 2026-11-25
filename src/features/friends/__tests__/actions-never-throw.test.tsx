/**
 * The actions of a friend's page run from a button: in a release build, an error that escapes
 * a button's handler, or a promise rejected with no one to catch it, can end the app. Whatever
 * the repository does, the handler returns, and the person reads a calm sentence.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import { DEMO_USERS } from '@/data/social';
import { SocialRuleError } from '@/domain/social';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';

import { FriendPage } from '../friends-pages';
import { signedInDemoForTest, withStore } from '../test-support/demo';

async function friendPageWith(sendNudge: () => Promise<void>) {
  await showLanguage('fr');
  const { store } = await signedInDemoForTest();
  store.client.repository.sendNudge = sendNudge;
  await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
  return screen.findByRole('button', { name: 'Encourager Sarah' });
}

describe("encouraging from a friend's page never throws out of the button", () => {
  it('survives a repository that throws before it returns a promise (no session yet)', async () => {
    const button = await friendPageWith(() => {
      throw new Error('session is null');
    });
    await fireEvent.press(button);
    expect(await screen.findByTestId('friend-refusal')).toBeOnTheScreen();
    // The button can be tried again: nothing was sent.
    expect(screen.getByRole('button', { name: 'Encourager Sarah' })).toBeEnabled();
  });

  it('says so when the encouragement is refused for another reason than "already today"', async () => {
    const button = await friendPageWith(async () => {
      throw new SocialRuleError('person-unavailable', 'gone');
    });
    await fireEvent.press(button);
    expect(await screen.findByTestId('friend-refusal')).toBeOnTheScreen();
  });

  it('still takes "already encouraged today" quietly, as a done button', async () => {
    const button = await friendPageWith(async () => {
      throw new SocialRuleError('already-nudged-today', 'sent from another phone');
    });
    await fireEvent.press(button);
    expect(await screen.findByRole('button', { name: 'Encouragé aujourd’hui' })).toBeDisabled();
    expect(screen.queryByTestId('friend-refusal')).toBeNull();
  });
});
