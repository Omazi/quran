/**
 * The pages of the Proches tab on the demonstration: each hook and its screen together, as a
 * person uses them, in French and Arabic, light and dark (docs/specs/ui-lot1.md, Revue et
 * vérification).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DEMO_GROUP_ID, DEMO_USERS } from '@/data/social';
import { SCREEN_CONDITIONS, showLanguage } from '@/features/garden/test-support/screen-conditions';
import type { ConfirmActionOptions } from '@/ui';
import {
  directionDependentStyles,
  fixedHeightsAroundText,
  LARGEST_FONT_SCALE,
  resetDeviceConditions,
  setDeviceConditions,
  touchTargetHeight,
} from '@/ui/test-support/environment';

import { AddFriendPage, FriendPage, FriendsHome, GroupPage, NewGroupPage } from '../friends-pages';
import { demoForTest, signedInDemoForTest, withStore } from '../test-support/demo';

afterEach(resetDeviceConditions);

const NAVIGATION = {
  openFriend: jest.fn(),
  openGroup: jest.fn(),
  addFriend: jest.fn(),
  createGroup: jest.fn(),
};

/** A text as a pattern that finds it anywhere, spaces of every kind included. */
function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s');
}

/** What every screen must keep in every condition: mirrored, nothing cut. */
function expectSoundLayout() {
  expect(directionDependentStyles(screen.container)).toEqual([]);
  expect(fixedHeightsAroundText(screen.container)).toEqual([]);
}

describe.each(SCREEN_CONDITIONS)('Proches tab ($scheme, $language)', ({ language, ...device }) => {
  it('asks to sign in first, Apple first, and says it is a demonstration', async () => {
    setDeviceConditions({ ...device, os: 'ios' });
    const t = (await showLanguage(language)).getFixedT(language, 'friends');
    const { store } = demoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));

    expect(await screen.findByRole('header', { name: t('title') })).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.props.accessibilityLabel ?? '')).toBeDefined();
    const apple = screen.getByRole('button', { name: t('signIn.apple') });
    const google = screen.getByRole('button', { name: t('signIn.google') });
    expect(screen.getByRole('button', { name: t('signIn.email') })).toBeOnTheScreen();
    expect(buttons.indexOf(apple)).toBeLessThan(buttons.indexOf(google));
    expect(touchTargetHeight(apple)).toBeGreaterThanOrEqual(44);
    expect(screen.getByText(t('signIn.demoNote'))).toBeOnTheScreen();
    expectSoundLayout();

    await fireEvent.press(apple);
    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
  });

  it('shows the requests, the gardens and the groups, with the demonstration note', async () => {
    setDeviceConditions(device);
    const t = (await showLanguage(language)).getFixedT(language, 'friends');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));

    expect(await screen.findByTestId('friends-list')).toBeOnTheScreen();
    expect(screen.getByTestId('friends-demo-note')).toHaveTextContent(t('demoNote'));
    expect(screen.getByText('Yacine')).toBeOnTheScreen();
    for (const id of [DEMO_USERS.mustapha, DEMO_USERS.sarah, DEMO_USERS.taghread]) {
      const card = screen.getByTestId(`friend-card-${id}`);
      expect(card).toHaveProp('accessibilityRole', 'button');
      expect(touchTargetHeight(card)).toBeGreaterThanOrEqual(44);
    }
    // Each card says its water in words, never by colour alone.
    expect(screen.getByTestId(`friend-card-${DEMO_USERS.sarah}`)).toHaveProp(
      'accessibilityLabel',
      expect.stringContaining(t('card.notWatered', { count: 6 })),
    );
    expect(screen.getByTestId(`group-${DEMO_GROUP_ID}`)).toBeOnTheScreen();
    expectSoundLayout();

    await fireEvent.press(screen.getByTestId(`friend-card-${DEMO_USERS.mustapha}`));
    expect(NAVIGATION.openFriend).toHaveBeenCalledWith(DEMO_USERS.mustapha);
  });

  it("shows a friend's page with the real counters and the hasanat as an estimate", async () => {
    setDeviceConditions(device);
    const t = (await showLanguage(language)).getFixedT(language, 'friends');
    const { store, demo } = await signedInDemoForTest();
    const view = await demo.repository.getPersonView(DEMO_USERS.mustapha);
    if (view?.kind !== 'friend' || view.level === null)
      throw new Error('Mustapha shares his level');
    await render(withStore(store, <FriendPage userId={DEMO_USERS.mustapha} goBack={jest.fn()} />));

    expect(await screen.findByTestId('friend')).toBeOnTheScreen();
    const number = (value: number) =>
      new RegExp(escaped(new Intl.NumberFormat(`${language}-u-nu-latn`).format(value)));
    expect(screen.getByTestId('friend-words')).toHaveTextContent(number(view.level.wordsRead));
    expect(screen.getByTestId('friend-verses')).toHaveTextContent(number(view.level.versesRead));
    expect(screen.getByTestId('friend-hasanat')).toHaveTextContent(
      number(view.level.hasanatEstimate),
    );
    expect(screen.getByTestId('friend-hasanat')).toHaveTextContent(
      new RegExp(escaped(t('friend.hasanat'))),
    );
    // Always an estimate, with its source (D37).
    expect(screen.getByText(t('friend.hasanatNote'))).toBeOnTheScreen();
    expect(t('friend.hasanatNote')).toContain('2910');
    expectSoundLayout();
  });
});

describe("a friend's page", () => {
  it('encourages once a day, then says so', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
    const button = await screen.findByRole('button', { name: 'Encourager Sarah' });
    await fireEvent.press(button);
    expect(await screen.findByRole('button', { name: 'Encouragé aujourd’hui' })).toBeDisabled();
  });

  it('asks before removing, in the destructive style, then goes back', async () => {
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const goBack = jest.fn();
    const asked: ConfirmActionOptions[] = [];
    await render(
      withStore(
        store,
        <FriendPage
          userId={DEMO_USERS.sarah}
          goBack={goBack}
          confirm={(options) => asked.push(options)}
        />,
      ),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Retirer de mes proches' }));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      title: 'Retirer Sarah de tes proches ?',
      confirmLabel: 'Retirer',
      cancelLabel: 'Annuler',
      isDestructive: true,
    });
    expect(goBack).not.toHaveBeenCalled();
    asked[0]?.onConfirm();
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    const friends = await demo.repository.listFriends();
    expect(friends.map((friend) => friend.userId)).not.toContain(DEMO_USERS.sarah);
  });

  it('asks before blocking, then the person is gone from the list', async () => {
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const asked: ConfirmActionOptions[] = [];
    const goBack = jest.fn();
    await render(
      withStore(
        store,
        <FriendPage userId={DEMO_USERS.taghread} goBack={goBack} confirm={(o) => asked.push(o)} />,
      ),
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Bloquer Taghread' }));
    expect(asked[0]).toMatchObject({ title: 'Bloquer Taghread ?', isDestructive: true });
    asked[0]?.onConfirm();
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(await demo.repository.listBlockedPeople()).toEqual([
      expect.objectContaining({ userId: DEMO_USERS.taghread }),
    ]);
  });

  it('shows only the name of someone who is not a friend', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendPage userId={DEMO_USERS.yacine} goBack={jest.fn()} />));
    expect(await screen.findByTestId('friend-not-friend')).toBeOnTheScreen();
    expect(screen.queryByTestId('friend-encourage')).toBeNull();
  });

  it('shows the sign-in screen when opened before signing in', async () => {
    await showLanguage('fr');
    const { store } = demoForTest();
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
    expect(await screen.findByTestId('friends-sign-in')).toBeOnTheScreen();
  });
});

describe('the list', () => {
  it('accepts a request: the person joins the gardens', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Accepter Yacine' }));
    expect(await screen.findByTestId(`friend-card-${DEMO_USERS.yacine}`)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Accepter Yacine' })).toBeNull();
  });

  it('keeps every word whole at the largest text size', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    await screen.findByTestId('friends-list');
    expect(fixedHeightsAroundText(screen.container)).toEqual([]);
    const limited = screen.container.queryAll(
      ({ type, props }) =>
        type === 'Text' && (props.numberOfLines !== undefined || props.allowFontScaling === false),
    );
    expect(limited).toHaveLength(0);
  });
});

describe('adding a friend', () => {
  it('finds a name as the person types and shows only the name and the relation', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <AddFriendPage openFriend={jest.fn()} />));
    await fireEvent.changeText(await screen.findByLabelText('Nom à chercher'), 'ya');
    expect(await screen.findByTestId(`add-result-${DEMO_USERS.yacine}`)).toHaveTextContent(
      /Yacine.*T’a envoyé une demande/,
    );
    expect(screen.getByRole('button', { name: 'Accepter Yacine' })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Nom à chercher'), 'zz');
    expect(await screen.findByText('Personne ne porte ce nom.')).toBeOnTheScreen();
  });

  it('shows my code in two groups and shares it through the system share sheet', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const share = jest.fn(async () => undefined);
    await render(withStore(store, <AddFriendPage openFriend={jest.fn()} share={share} />));
    await waitFor(() =>
      expect(screen.getByTestId('add-my-code')).toHaveTextContent(/[A-Z0-9]{4} [A-Z0-9]{4}/),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Partager mon code' }));
    expect(share).toHaveBeenCalledWith(expect.stringMatching(/quranapp:\/\/invite\/[A-Z0-9]{8}/));
  });

  it('refuses a code that does not exist, and opens the friend of a good code', async () => {
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const invite = await demo.repositoryAs(DEMO_USERS.yacine).createInvite();
    const openFriend = jest.fn();
    await render(withStore(store, <AddFriendPage openFriend={openFriend} />));
    const field = await screen.findByLabelText('Code d’invitation');
    await fireEvent.changeText(field, 'abcd efgh');
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ce proche' }));
    expect(await screen.findByText('Aucune invitation ne porte ce code.')).toBeOnTheScreen();
    // Typed in lower case and in two groups: the screen puts it in capitals, the rules check it.
    const typed = `${invite.code.slice(0, 4)} ${invite.code.slice(4)}`.toLowerCase();
    await fireEvent.changeText(field, typed);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ce proche' }));
    await waitFor(() => expect(openFriend).toHaveBeenCalledWith(DEMO_USERS.yacine));
  });

  it('leaves a named slot for the QR code and a disabled scan', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <AddFriendPage openFriend={jest.fn()} />));
    expect(
      await screen.findByRole('image', { name: 'QR code de mon invitation' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Scanner un QR code' })).toBeDisabled();
  });
});

describe('groups', () => {
  it('ranks the members over the week, then the month, and marks me', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <GroupPage groupId={DEMO_GROUP_ID} openPerson={jest.fn()} />));
    expect(await screen.findByTestId(`group-line-${DEMO_USERS.omar}`)).toHaveTextContent(/\(toi\)/);
    expect(
      screen.getByText('Pages lues pour la première fois, du lundi au dimanche.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Mois' }));
    expect(
      await screen.findByText('Pages lues pour la première fois, ce mois-ci.'),
    ).toBeOnTheScreen();
  });

  it('creates a group, then adds a friend to it without asking them', async () => {
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const openGroup = jest.fn();
    await render(withStore(store, <NewGroupPage openGroup={openGroup} />));
    await fireEvent.changeText(await screen.findByLabelText('Nom du groupe'), 'Amis');
    await fireEvent.press(screen.getByRole('button', { name: 'Créer le groupe' }));
    await waitFor(() => expect(openGroup).toHaveBeenCalled());
    const groupId = openGroup.mock.calls[0]?.[0] as string; // the id the page reported

    await render(withStore(store, <GroupPage groupId={groupId} openPerson={jest.fn()} />));
    expect(await screen.findByText(/Tes proches entrent sans avoir à accepter/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter Sarah' }));
    await waitFor(async () =>
      expect((await demo.repository.listGroupMembers(groupId)).map((m) => m.userId)).toContain(
        DEMO_USERS.sarah,
      ),
    );
  });

  it('refuses an empty name with a sentence', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <NewGroupPage openGroup={jest.fn()} />));
    await fireEvent.changeText(await screen.findByLabelText('Nom du groupe'), '   ');
    expect(screen.getByRole('button', { name: 'Créer le groupe' })).toBeDisabled();
  });

  it('says a group of others is not found', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <GroupPage groupId="no-such-group" openPerson={jest.fn()} />));
    expect(await screen.findByTestId('group-not-found')).toBeOnTheScreen();
  });
});
