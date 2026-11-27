/**
 * The Proches tab without a sign-in screen (owner's decision): while real accounts are not set
 * up, the `friendsSignIn` flag of app.json stays off and the tab opens straight on the friends of
 * the demonstration, said to be one, with the ways to add a friend by code or QR code.
 */

import { render, screen } from '@testing-library/react-native';

import appJson from '../../../../app.json';
import { DEMO_USERS } from '@/data/social';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';

import { FriendPage, FriendsHome } from '../friends-pages';
import { readFriendsSignInFlag } from '../sign-in-flag';
import { demoForTest, withStore } from '../test-support/demo';

const NAVIGATION = {
  openFriend: jest.fn(),
  openGroup: jest.fn(),
  addFriend: jest.fn(),
  createGroup: jest.fn(),
  openScanner: jest.fn(),
};

describe('the friendsSignIn feature flag', () => {
  it('is on only for a real true', () => {
    expect(readFriendsSignInFlag({ features: { friendsSignIn: true } })).toBe(true);
    expect(readFriendsSignInFlag({ features: { friendsSignIn: false } })).toBe(false);
    expect(readFriendsSignInFlag({ features: { friendsSignIn: 'true' } })).toBe(false);
    expect(readFriendsSignInFlag({ features: {} })).toBe(false);
    expect(readFriendsSignInFlag({})).toBe(false);
    expect(readFriendsSignInFlag(null)).toBe(false);
  });

  it('is on in this build: the owner sees every screen while he tests (27 November 2026)', () => {
    expect(appJson.expo.extra.features.friendsSignIn).toBe(true);
  });
});

describe('the tab with the flag off', () => {
  it('opens straight on the friends, says it is a demonstration, and never shows a sign-in', async () => {
    await showLanguage('fr');
    const { store } = demoForTest({ showsSignIn: false });
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));

    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
    expect(screen.queryByTestId('friends-sign-in')).toBeNull();
    expect(screen.getByTestId('friends-demo-note')).toHaveTextContent(/^Démonstration/);
    // The ways to add someone come first, without an account (maquettes 2026-11-26, "friends").
    expect(screen.getByRole('button', { name: 'Mon QR code' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Scanner un QR code' })).toBeOnTheScreen();
  });

  it('opens a page reached by a link straight away too', async () => {
    await showLanguage('fr');
    const { store } = demoForTest({ showsSignIn: false });
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
    expect(await screen.findByTestId('friend')).toBeOnTheScreen();
    expect(screen.queryByTestId('friends-sign-in')).toBeNull();
  });

  it('says the tab cannot open when the local session cannot start', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await showLanguage('fr');
    const { demo, store } = demoForTest({ showsSignIn: false });
    jest.spyOn(demo.auth, 'signInWithApple').mockRejectedValue(new Error('broken'));
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-failed')).toBeOnTheScreen();
    expect(screen.queryByTestId('friends-sign-in')).toBeNull();
    warn.mockRestore();
  });
});

describe('the tab with the flag on', () => {
  it('still asks to sign in first', async () => {
    await showLanguage('fr');
    const { store } = demoForTest({ showsSignIn: true });
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-sign-in')).toBeOnTheScreen();
  });
});
