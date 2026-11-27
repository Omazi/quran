/**
 * The anonymous account of the phone (flag `friendsAnonymous`, docs/AUTH-SETUP.md, "Connexion
 * anonyme"): no sign-in screen; the tab opens a real account by itself and adds friends by code
 * on the real tables. With the flag off, the demonstration, as before.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import appJson from '../../../../app.json';
import {
  createAnonymousAuth,
  createMemorySessionStorage,
  deviceAnonymousAuth,
  deviceSessionStorage,
} from '@/data/auth';
import { createSupabaseSocial } from '@/data/social';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { deviceLocalDate } from '@/features/home';

import { chooseSocialClient, chooseSyncSession } from '../anonymous-account';
import { readFriendsAnonymousFlag } from '../anonymous-flag';
import { createDemoSocial } from '@/data/social';
import { AccountInvitationSheet } from '@/features/home/account-invitation-sheet';

import { AddFriendPage, FriendsHome } from '../friends-pages';
import { SIGN_IN_PROVIDERS_READY } from '../sign-in-flag';
import { createSocialStore } from '../social-store';
import { withStore } from '../test-support/demo';

const CONFIG = { url: 'https://project.supabase.co', publicKey: 'sb_publishable_test_key_123456' };
const ME = '11111111-1111-4111-8111-111111111111';
const NOUR = '33333333-3333-4333-8333-333333333333';
const today = () => deviceLocalDate(new Date());

const NAVIGATION = {
  openFriend: jest.fn(),
  openGroup: jest.fn(),
  addFriend: jest.fn(),
  createGroup: jest.fn(),
  openScanner: jest.fn(),
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

/** A fake project with nobody yet: one anonymous sign-up, then an empty Proches tab. */
function fakeProject() {
  const paths: string[] = [];
  let friends: unknown[] = [];
  const request = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(CONFIG.url, '');
    paths.push(`${init?.method ?? 'GET'} ${path}`);
    if (path === '/auth/v1/signup') {
      return json(200, {
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        user: { id: ME, is_anonymous: true },
      });
    }
    if (path.startsWith('/rest/v1/profiles?select=id&')) return json(200, [{ id: ME }]);
    if (path === '/rest/v1/rpc/list_friends') return json(200, friends);
    if (path.startsWith('/rest/v1/friendships?')) return json(200, []);
    if (path.startsWith('/rest/v1/groups?')) return json(200, []);
    if (path === '/rest/v1/rpc/create_invite') {
      return json(200, [{ code: 'KQ7MWP3X', expires_on: '2099-01-08' }]);
    }
    if (path === '/rest/v1/rpc/accept_invite') {
      const { p_code: code } = JSON.parse(String(init?.body)) as { p_code: string };
      if (code !== 'ABCDEFGH') return json(200, 'invite_not_found');
      friends = [
        {
          friend_id: NOUR,
          display_name: 'Nour',
          garden_visible: true,
          level_visible: false,
          level: null,
          hizb_completed: null,
          health: null,
          last_watered_on: null,
          streak_days: null,
          badge_count: null,
          words_read: null,
          verses_read: null,
          hasanat_estimate: null,
          updated_on: null,
        },
      ];
      return json(200, 'accepted');
    }
    throw new Error(`unexpected ${path}`);
  }) as typeof fetch;
  const auth = createAnonymousAuth({
    config: CONFIG,
    storage: createMemorySessionStorage(),
    fetch: request,
  });
  const client = createSupabaseSocial({
    config: CONFIG,
    auth,
    today,
    newProfileName: () => 'Proche',
    fetch: request,
  });
  return { paths, auth, store: createSocialStore(client, { showsSignIn: false }) };
}

describe('the friendsAnonymous feature flag', () => {
  it('is on only for a real true', () => {
    expect(readFriendsAnonymousFlag({ features: { friendsAnonymous: true } })).toBe(true);
    expect(readFriendsAnonymousFlag({ features: { friendsAnonymous: false } })).toBe(false);
    expect(readFriendsAnonymousFlag({ features: { friendsAnonymous: 'true' } })).toBe(false);
    expect(readFriendsAnonymousFlag({ features: {} })).toBe(false);
    expect(readFriendsAnonymousFlag(null)).toBe(false);
  });

  it('is on in this build (owner, 27 November 2026: "ne cache rien"), with the demonstration as fallback', () => {
    expect(appJson.expo.extra.features.friendsAnonymous).toBe(true);
  });
});

describe('which client and which sync account', () => {
  const auth = createAnonymousAuth({ config: CONFIG, storage: createMemorySessionStorage() });

  it('flag off: the demonstration, and no account for the sync', () => {
    const client = chooseSocialClient({ isAnonymousEnabled: false, auth, config: CONFIG, today });
    expect(client.isDemonstration).toBe(true);
    expect(chooseSyncSession({ isAnonymousEnabled: false, auth })).toBeNull();
  });

  it('flag on: the real tables, and the same account for the sync', () => {
    const client = chooseSocialClient({ isAnonymousEnabled: true, auth, config: CONFIG, today });
    expect(client.isDemonstration).toBe(false);
    expect(client.openSilently).toBeDefined();
    expect(chooseSyncSession({ isAnonymousEnabled: true, auth })).not.toBeNull();
  });

  it('flag on but no account possible (no project, no keychain): as with the flag off', () => {
    expect(
      chooseSocialClient({ isAnonymousEnabled: true, auth: null, config: CONFIG, today })
        .isDemonstration,
    ).toBe(true);
    expect(
      chooseSocialClient({ isAnonymousEnabled: true, auth, config: null, today }).isDemonstration,
    ).toBe(true);
    expect(chooseSyncSession({ isAnonymousEnabled: true, auth: null })).toBeNull();
  });

  it('this build has no keychain module yet: the phone makes no account, tokens are never in clear', () => {
    expect(deviceSessionStorage).toBeNull();
    expect(deviceAnonymousAuth()).toBeNull();
  });
});

describe('the tab on the real tables', () => {
  it('opens a real account by itself, once, and shows my real code, not a demonstration', async () => {
    await showLanguage('fr');
    const { store, paths } = fakeProject();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
    expect(screen.queryByTestId('friends-sign-in')).toBeNull();
    expect(screen.queryByTestId('friends-demo-note')).toBeNull();
    expect(paths.filter((path) => path.endsWith('/auth/v1/signup'))).toHaveLength(1);
  });

  it('adds a friend by code on the real tables and opens their page', async () => {
    await showLanguage('fr');
    const { store, paths } = fakeProject();
    await store.client.openSilently?.();
    const openFriend = jest.fn();
    await render(
      withStore(store, <AddFriendPage openFriend={openFriend} openScanner={jest.fn()} />),
    );
    await waitFor(() => expect(screen.getByTestId('add-my-code')).toHaveTextContent(/KQ7M WP3X/));
    const field = await screen.findByLabelText('Code d’invitation');
    await fireEvent.changeText(field, 'zzzz zzzz');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ce proche' }));
    expect(await screen.findByText('Aucune invitation ne porte ce code.')).toBeOnTheScreen();
    await fireEvent.changeText(field, 'abcd efgh');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ce proche' }));
    await waitFor(() => expect(openFriend).toHaveBeenCalledWith(NOUR));
    expect(paths).toContain('POST /rest/v1/rpc/accept_invite');
  });
});

/** A real client whose anonymous sign-up is refused (switch off in the dashboard) or offline. */
function brokenProject(answer: () => Response) {
  const request = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/auth/v1/signup')) return answer();
    throw new Error(`unexpected ${String(input)}`);
  }) as typeof fetch;
  const auth = createAnonymousAuth({
    config: CONFIG,
    storage: createMemorySessionStorage(),
    fetch: request,
  });
  return createSupabaseSocial({
    config: CONFIG,
    auth,
    today,
    newProfileName: () => 'Proche',
    fetch: request,
  });
}

describe('when the anonymous account cannot be made: the demonstration, one calm line', () => {
  it.each([
    [
      'the switch is off in the dashboard',
      () => json(422, { error_code: 'anonymous_provider_disabled' }),
    ],
    [
      'there is no network',
      () => {
        throw new TypeError('Network request failed');
      },
    ],
  ])('%s', async (_case, answer) => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await showLanguage('fr');
    const store = createSocialStore(brokenProject(answer), {
      showsSignIn: false,
      fallback: () => createDemoSocial({ today }),
    });
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
    expect(screen.queryByTestId('friends-failed')).toBeNull();
    expect(screen.getByTestId('friends-demo-note')).toHaveTextContent(
      'Pas encore relié au serveur : voici des proches de démonstration.',
    );
    expect(store.client.isDemonstration).toBe(true);
  });

  it('a build with the flag on but no keychain starts on the demonstration with the same line', async () => {
    await showLanguage('fr');
    const store = createSocialStore(createDemoSocial({ today }), {
      showsSignIn: false,
      notice: 'not-connected',
    });
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-demo-note')).toHaveTextContent(/^Pas encore relié/);
  });
});

describe('Apple, Google and the e-mail before they are set up: "Bientôt disponible"', () => {
  it('are not ready in this build', () => {
    expect(SIGN_IN_PROVIDERS_READY).toBe(false);
  });

  it('the sign-in screen shows them, says they come soon, and lets the person in without an account', async () => {
    await showLanguage('fr');
    const store = createSocialStore(createDemoSocial({ today }), {
      showsSignIn: true,
      providersReady: false,
    });
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    expect(await screen.findByTestId('friends-sign-in')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-coming-soon')).toHaveTextContent(/^Bientôt disponible/);
    await fireEvent.press(screen.getByTestId('sign-in-apple'));
    expect(
      await screen.findByText('Bientôt disponible. En attendant, continue sans compte.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sign-in-email'));
    // No e-mail field: nothing is offered that cannot work.
    expect(screen.queryByTestId('sign-in-email-field')).toBeNull();
    // Still no session: the buttons did not pretend.
    expect(await store.client.auth.getSession()).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer sans compte' }));
    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
  });

  it('the invitation over the new garden says it too, and the e-mail does not lead away', async () => {
    await showLanguage('fr');
    const store = createSocialStore(createDemoSocial({ today }), { providersReady: false });
    const onOpenEmail = jest.fn();
    const onDismiss = jest.fn();
    await render(
      withStore(store, <AccountInvitationSheet onDismiss={onDismiss} onOpenEmail={onOpenEmail} />),
    );
    await fireEvent.press(screen.getByTestId('sign-in-google'));
    expect(
      await screen.findByText('Bientôt disponible. En attendant, continue sans compte.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sign-in-email'));
    expect(onOpenEmail).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
    expect(await store.client.auth.getSession()).toBeNull();
  });
});
