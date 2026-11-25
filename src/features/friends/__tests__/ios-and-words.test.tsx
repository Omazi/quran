/**
 * What an iPhone is given (every SwiftUI view has a host, no React Native view hides inside
 * SwiftUI), and the translations of the tab (the same keys in French, English and Arabic).
 */

import { DEMO_GROUP_ID, DEMO_USERS } from '@/data/social';
import { deviceLocalDate } from '@/features/home';
import {
  reactNativeViewsInsideSwiftUI,
  showLanguage,
} from '@/features/garden/test-support/screen-conditions';
import { resources } from '@/i18n/resources';
import {
  renderOnIOS,
  resetDeviceConditions,
  setDeviceConditions,
} from '@/ui/test-support/environment';

import { AddFriendScreen } from '../add-friend-screen';
import { FriendScreen } from '../friend-screen';
import { FriendsListScreen } from '../friends-list-screen';
import { buildFriendPageModel, buildFriendsModel, buildGroupModel } from '../friends-model';
import { GroupScreen, NewGroupScreen } from '../group-screen';
import { ScanInviteScreen } from '../scan-invite-screen';
import { SignInScreen } from '../sign-in-screen';
import { signedInDemoForTest } from '../test-support/demo';

jest.mock(
  'expo-camera',
  () =>
    jest.requireActual<typeof import('../test-support/camera')>('../test-support/camera')
      .fakeExpoCamera,
);

afterEach(resetDeviceConditions);

const noop = () => undefined;

describe.each(['fr', 'ar'] as const)('on iOS (%s)', (language) => {
  beforeEach(async () => {
    setDeviceConditions({ os: 'ios', rightToLeft: language === 'ar' });
    await showLanguage(language);
  });

  it('the sign-in screen, with the e-mail steps open', async () => {
    await renderOnIOS(
      <SignInScreen
        model={{
          isDemonstration: true,
          providers: ['apple', 'google', 'email'],
          emailStep: 'code',
          email: 'omar@example.com',
          code: '',
          isBusy: false,
          refusal: 'email-code-malformed',
        }}
        actions={{
          signInWithApple: noop,
          signInWithGoogle: noop,
          openEmail: noop,
          changeEmail: noop,
          requestCode: noop,
          changeCode: noop,
          signInWithEmail: noop,
        }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
  });

  it('the list, a friend, adding, a group, a new group', async () => {
    const { demo } = await signedInDemoForTest();
    const { repository } = demo;
    const today = deviceLocalDate(new Date());
    const friends = await repository.listFriends();

    await renderOnIOS(
      <FriendsListScreen
        model={buildFriendsModel({
          isDemonstration: true,
          friends,
          requests: await repository.listFriendRequests(),
          groups: (await repository.listMyGroups()).map((group) => ({ group, memberCount: 4 })),
          today,
        })}
        refusal="unknown"
        actions={{
          openFriend: noop,
          openGroup: noop,
          addFriend: noop,
          createGroup: noop,
          accept: noop,
          decline: noop,
        }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);

    await renderOnIOS(
      <FriendScreen
        model={buildFriendPageModel({
          isDemonstration: true,
          view: await repository.getPersonView(DEMO_USERS.mustapha),
          encouragedToday: false,
          today,
        })}
        refusal={null}
        actions={{ encourage: noop, remove: noop, block: noop }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);

    await renderOnIOS(
      <AddFriendScreen
        model={{
          isDemonstration: true,
          query: 'ya',
          results: await repository.searchPeople('ya'),
          searchRefusal: null,
          invite: await repository.createInvite(),
          code: 'abcd',
          codeRefusal: 'invite-not-found',
          isBusy: false,
        }}
        actions={{
          changeQuery: noop,
          sendRequest: noop,
          acceptRequest: noop,
          openFriend: noop,
          shareInvite: noop,
          changeCode: noop,
          submitCode: noop,
          scan: noop,
        }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);

    const [group] = await repository.listMyGroups();
    if (group === undefined) throw new Error('the demonstration has a group');
    await renderOnIOS(
      <GroupScreen
        model={buildGroupModel({
          isDemonstration: true,
          group,
          period: 'week',
          leaderboard: await repository.getGroupLeaderboard(DEMO_GROUP_ID, {
            kind: 'week',
            day: today,
          }),
          memberIds: [DEMO_USERS.omar],
          friends,
          myId: DEMO_USERS.omar,
        })}
        refusal={null}
        actions={{ changePeriod: noop, addMember: noop, openPerson: noop }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);

    await renderOnIOS(
      <NewGroupScreen
        model={{ isDemonstration: true, name: '', refusal: 'name-empty', isBusy: false }}
        actions={{ changeName: noop, create: noop }}
      />,
    );
    expect(reactNativeViewsInsideSwiftUI()).toEqual([]);

    const scanActions = {
      scanned: noop,
      askForCamera: noop,
      openSettings: noop,
      cameraFailed: noop,
    };
    for (const camera of ['granted', 'blocked', 'askable'] as const) {
      await renderOnIOS(
        <ScanInviteScreen
          model={{ camera, cameraFailed: false, note: 'not-an-invitation', isBusy: false }}
          actions={scanActions}
        />,
      );
      expect(reactNativeViewsInsideSwiftUI()).toEqual([]);
    }
  });
});

/** Suffixes i18next adds to a key that depends on a number, by plural category. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

describe('translations of the tab', () => {
  it('have the same keys in French, English and Arabic', () => {
    const plain = (language: 'fr' | 'en' | 'ar') =>
      [
        ...new Set(
          keysOf(resources[language].friends).map((key) => key.replace(PLURAL_SUFFIX, '')),
        ),
      ].sort();
    expect(plain('en')).toEqual(plain('fr'));
    expect(plain('ar')).toEqual(plain('fr'));
  });

  it('give Arabic every plural form it needs', () => {
    const arabic = keysOf(resources.ar.friends);
    const counted = [
      ...new Set(
        arabic
          .filter((key) => PLURAL_SUFFIX.test(key))
          .map((key) => key.replace(PLURAL_SUFFIX, '')),
      ),
    ];
    for (const key of counted) {
      for (const form of ['zero', 'one', 'two', 'few', 'many', 'other']) {
        expect(arabic).toContain(`${key}_${form}`);
      }
    }
  });

  it('name the tab in all three languages', () => {
    expect(resources.fr.common.tabs.friends).toBe('Proches');
    expect(resources.en.common.tabs.friends).toBe('Friends');
    expect(resources.ar.common.tabs.friends).toBe('الأحبّة');
  });

  it('say the hasanat are an estimate, with their source, in every language', () => {
    for (const language of ['fr', 'en', 'ar'] as const) {
      expect(resources[language].friends.friend.hasanatNote).toContain('2910');
    }
  });
});
