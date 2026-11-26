/**
 * The pages of the Proches tab on the demonstration: each hook and its screen together, as a
 * person uses them, in French and Arabic, light and dark (docs/specs/ui-lot1.md, Revue et
 * vérification).
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

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

import { inviteLink, parseInviteLink } from '@/domain/social';
import { deviceLocalDate } from '@/features/home';
import { qrCodeModules } from '@/ui';

import {
  AddFriendPage,
  FriendPage,
  FriendsHome,
  GroupPage,
  NewGroupPage,
  ScanInvitePage,
  type FriendOptionsMenu,
} from '../friends-pages';
import { buildFriendsModel } from '../friends-model';
import { cameraQuestionsShown, setCamera, type FakeCameraViewProps } from '../test-support/camera';
import { demoForTest, signedInDemoForTest, withStore } from '../test-support/demo';

jest.mock(
  'expo-camera',
  () =>
    jest.requireActual<typeof import('../test-support/camera')>('../test-support/camera')
      .fakeExpoCamera,
);

afterEach(resetDeviceConditions);
beforeEach(() => setCamera('undetermined'));

/** The add page with the navigation it needs, and what it was asked to open. */
function addFriendPage(props: Partial<Parameters<typeof AddFriendPage>[0]> = {}) {
  return <AddFriendPage openFriend={jest.fn()} openScanner={jest.fn()} {...props} />;
}

/** The modules a path of `QrCode` draws: one rectangle per run, `M{x} {y}h{n}v1h{-n}z`. */
function modulesOfPath(path: string, size: number): boolean[][] {
  const modules = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  for (const [, x, y, run] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let step = 0; step < Number(run); step += 1) {
      const row = modules[Number(y)];
      if (row !== undefined) row[Number(x) + step] = true;
    }
  }
  return modules;
}

/** Makes the fake camera read a text, as when a code comes into view. */
async function cameraReads(text: string) {
  const preview = await screen.findByTestId('camera-view');
  await fireEvent(preview, 'barcodeScanned', { data: text, type: 'qr' });
  return preview.props as FakeCameraViewProps;
}

const NAVIGATION = {
  openFriend: jest.fn(),
  openGroup: jest.fn(),
  addFriend: jest.fn(),
  createGroup: jest.fn(),
  openScanner: jest.fn(),
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
  it('with the friendsSignIn flag on: asks to sign in first, Apple first, says it is a demonstration', async () => {
    setDeviceConditions({ ...device, os: 'ios' });
    const t = (await showLanguage(language)).getFixedT(language, 'friends');
    const { store } = demoForTest({ showsSignIn: true });
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
    // The gardens of the demonstration are examples, each marked, in words for VoiceOver too.
    expect(screen.getByText(t('list.examples'))).toBeOnTheScreen();
    expect(screen.getByTestId(`friend-card-${DEMO_USERS.mustapha}-example`)).toHaveTextContent(
      t('card.example'),
    );
    expect(screen.getByTestId(`friend-card-${DEMO_USERS.mustapha}`)).toHaveProp(
      'accessibilityLabel',
      expect.stringMatching(new RegExp(`^${escaped(t('card.example'))}`)),
    );
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
      throw new Error('Mostapha shares his level');
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
    expect(await screen.findByRole('button', { name: 'Encouragée aujourd’hui' })).toBeDisabled();
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

  it('says the hizb and the water as the visit does, with sixty dots for the hizb', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendPage userId={DEMO_USERS.mustapha} goBack={jest.fn()} />));
    const dots = await screen.findByTestId('friend-hizb');
    expect(dots).toHaveProp('accessibilityRole', 'progressbar');
    expect(dots.props.accessibilityValue).toMatchObject({ min: 0, max: 60 });
    expect(screen.getByTestId('friend-summary')).toHaveTextContent(/^\d+ hizb sur 60, /);
    expect(screen.getAllByTestId(/^friend-hizb-dot-/)).toHaveLength(60);
  });

  it('opens the reader from its second button', async () => {
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

  it('gives the streak, the verses read and the level in the card, side by side', async () => {
    setDeviceConditions({ fontScale: 1 });
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const view = await demo.repository.getPersonView(DEMO_USERS.mustapha);
    if (view?.kind !== 'friend' || view.level === null || view.garden === null) {
      throw new Error('Mostapha shares his garden and his level');
    }
    await render(withStore(store, <FriendPage userId={DEMO_USERS.mustapha} goBack={jest.fn()} />));
    const card = await screen.findByTestId('friend-card');
    const stats = within(card).getByTestId('friend-stats');
    expect(stats).toHaveStyle({ flexDirection: 'row' });
    expect(within(stats).getByTestId('friend-streak')).toHaveProp(
      'accessibilityLabel',
      `Série, ${view.garden.streakDays} jours`,
    );
    expect(within(stats).getByTestId('friend-streak')).toHaveTextContent(
      `${view.garden.streakDays} jSérie`,
    );
    expect(within(stats).getByTestId('friend-verses')).toHaveTextContent(
      new RegExp(
        `^${escaped(new Intl.NumberFormat('fr-u-nu-latn').format(view.level.versesRead))}Versets lus$`,
      ),
    );
    expect(within(stats).getByTestId('friend-level')).toHaveTextContent(
      `${view.level.level}Niveau`,
    );
    // The two buttons of the visit, the soft one first (maquettes 2026-11-26, "friend").
    expect(within(card).getByRole('button', { name: 'Encourager Mostapha' })).toBeOnTheScreen();
    expect(within(card).getByRole('button', { name: 'Lire avec lui' })).toHaveTextContent(
      'Lire avec lui',
    );
  });

  it('puts removing and blocking in the More menu of the bar when the route gives one', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const asked: ConfirmActionOptions[] = [];
    const menus: FriendOptionsMenu[] = [];
    await render(
      withStore(
        store,
        <FriendPage
          userId={DEMO_USERS.sarah}
          goBack={jest.fn()}
          confirm={(options) => asked.push(options)}
          renderOptions={(menu) => {
            menus.push(menu);
            return null;
          }}
        />,
      ),
    );
    await screen.findByTestId('friend');
    // Not on the page: in the menu, both destructive (pull-down-buttons.md › Best practices).
    expect(screen.queryByRole('button', { name: 'Retirer de mes proches' })).toBeNull();
    const menu = menus.at(-1);
    expect(menu?.label).toBe('Plus d’options');
    expect(menu?.items.map(({ label, isDestructive }) => [label, isDestructive])).toEqual([
      ['Retirer de mes proches', true],
      ['Bloquer Sarah', true],
    ]);
    // Choosing an item still asks first, with an action sheet.
    menu?.items[0]?.onPress();
    expect(asked[0]).toMatchObject({ title: 'Retirer Sarah de tes proches ?' });
  });

  it('shows only the name of someone who is not a friend', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendPage userId={DEMO_USERS.yacine} goBack={jest.fn()} />));
    expect(await screen.findByTestId('friend-not-friend')).toBeOnTheScreen();
    expect(screen.queryByTestId('friend-encourage')).toBeNull();
  });

  it('with the friendsSignIn flag on: shows the sign-in screen when opened before signing in', async () => {
    await showLanguage('fr');
    const { store } = demoForTest({ showsSignIn: true });
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
    expect(await screen.findByTestId('friends-sign-in')).toBeOnTheScreen();
  });
});

describe('the list', () => {
  it('answers a request on one row: Accepter prominent, Refuser plain, the name for VoiceOver', async () => {
    setDeviceConditions({ fontScale: 1 });
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    const accept = await screen.findByRole('button', { name: 'Accepter Yacine' });
    const decline = screen.getByRole('button', { name: 'Refuser Yacine' });
    expect(accept).toHaveTextContent('Accepter');
    expect(decline).toHaveTextContent('Refuser');
    // Side by side: the nearest view around both lays its children out in a row.
    let row = accept.parent;
    while (row !== null && !row.queryAll(() => true).includes(decline)) row = row.parent;
    expect(row).toHaveStyle({ flexDirection: 'row' });
    expect(touchTargetHeight(accept)).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(decline)).toBeGreaterThanOrEqual(44);
  });

  it('stacks Accepter and Refuser at the largest text size, each still 44 points high', async () => {
    setDeviceConditions({ fontScale: LARGEST_FONT_SCALE });
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    const accept = await screen.findByRole('button', { name: 'Accepter Yacine' });
    const decline = screen.getByRole('button', { name: 'Refuser Yacine' });
    let around = accept.parent;
    while (around !== null && !around.queryAll(() => true).includes(decline)) {
      around = around.parent;
    }
    expect(around).not.toHaveStyle({ flexDirection: 'row' });
    expect(touchTargetHeight(accept)).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(decline)).toBeGreaterThanOrEqual(44);
  });

  it('declines a request: the person is gone from the requests, not added', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'Refuser Yacine' }));
    await waitFor(() => expect(screen.queryByTestId(`request-${DEMO_USERS.yacine}`)).toBeNull());
    expect(screen.queryByTestId(`friend-card-${DEMO_USERS.yacine}`)).toBeNull();
  });

  it('says it is a demonstration once, on the list, not on the pages it opens', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const demoNote = /Démonstration : ces personnes sont inventées/;
    await render(withStore(store, <FriendPage userId={DEMO_USERS.sarah} goBack={jest.fn()} />));
    await screen.findByTestId('friend');
    expect(screen.queryByText(demoNote)).toBeNull();
    await render(withStore(store, <GroupPage groupId={DEMO_GROUP_ID} openPerson={jest.fn()} />));
    await screen.findByTestId('group');
    expect(screen.queryByText(demoNote)).toBeNull();
    await render(withStore(store, <NewGroupPage openGroup={jest.fn()} />));
    await screen.findByTestId('new-group');
    expect(screen.queryByText(demoNote)).toBeNull();
  });

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
    // The initial of an avatar is a shape, hidden from VoiceOver, kept inside its circle (Avatar);
    // every word that is read grows.
    const limited = screen.container.queryAll(
      ({ type, props, parent }) =>
        type === 'Text' &&
        parent?.props.accessibilityElementsHidden !== true &&
        (props.numberOfLines !== undefined || props.allowFontScaling === false),
    );
    expect(limited).toHaveLength(0);
  });
});

describe('the list without an account: adding at the top (maquettes 2026-11-26, "friends")', () => {
  beforeEach(() => {
    NAVIGATION.addFriend.mockClear();
    NAVIGATION.openScanner.mockClear();
  });

  it('opens on "Ajoute tes proches", before the gardens, and says the codes are a demonstration', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    const card = await screen.findByTestId('friends-add-card');
    expect(within(card).getByRole('header', { name: 'Ajoute tes proches' })).toBeOnTheScreen();
    expect(
      within(card).getByText('Vois leurs jardins pousser et encouragez-vous.'),
    ).toBeOnTheScreen();
    // Honest while the server is not there: the code does not reach another phone yet.
    expect(within(card).getByTestId('friends-demo-note')).toHaveTextContent(
      'Démonstration : les codes ne relient pas encore deux téléphones, et rien ne quitte le tien.',
    );
    expect(screen.queryByText(/Pas besoin de compte/)).toBeNull();
    const list = screen.getByTestId('friends-list');
    const order = list.queryAll(
      ({ props }) => props.testID === 'friends-add-card' || props.testID === 'friends-grid',
    );
    expect(order.map(({ props }) => props.testID)).toEqual(['friends-add-card', 'friends-grid']);
  });

  it('offers two ways, Scanner and Mon QR code, and no search by name (owner decision)', async () => {
    setDeviceConditions({ fontScale: 1 });
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <FriendsHome {...NAVIGATION} />));
    const card = await screen.findByTestId('friends-add-card');
    const scan = within(card).getByRole('button', { name: 'Scanner un QR code' });
    const myQr = within(card).getByRole('button', { name: 'Mon QR code' });
    expect(scan).toHaveTextContent('Scanner');
    expect(touchTargetHeight(scan)).toBeGreaterThanOrEqual(44);
    expect(touchTargetHeight(myQr)).toBeGreaterThanOrEqual(44);
    expect(within(card).queryByText(/Par nom/)).toBeNull();
    expect(screen.queryByLabelText('Nom à chercher')).toBeNull();

    await fireEvent.press(myQr);
    expect(NAVIGATION.addFriend).toHaveBeenCalledTimes(1);
    expect(cameraQuestionsShown()).toBe(0);
    await fireEvent.press(scan);
    await waitFor(() => expect(NAVIGATION.openScanner).toHaveBeenCalledTimes(1));
    expect(cameraQuestionsShown()).toBe(1);
  });

  it('shows my code in two groups and shares it, with its link, from the card', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const share = jest.fn(async () => undefined);
    await render(withStore(store, <FriendsHome {...NAVIGATION} share={share} />));
    const code = await screen.findByTestId('friends-my-code');
    await waitFor(() => expect(code).toHaveTextContent(/^Mon code[A-Z0-9]{4} [A-Z0-9]{4}$/));
    await fireEvent.press(screen.getByRole('button', { name: 'Partager mon code' }));
    expect(share).toHaveBeenCalledWith(expect.stringMatching(/quranapp:\/\/invite\/[A-Z0-9]{8}/));
    // The same code as the sheet will show: one invitation, kept by the tab.
    const kept = store.invite()?.code;
    if (kept === undefined) throw new Error('No invitation was made.');
    expect(code).toHaveTextContent(`Mon code${kept.slice(0, 4)} ${kept.slice(4)}`);
  });

  it('without the demonstration, shows real friends without the Exemple mark', async () => {
    await showLanguage('fr');
    const { demo } = await signedInDemoForTest();
    const friends = await demo.repository.listFriends();
    const model = buildFriendsModel({
      isDemonstration: false,
      friends,
      requests: { incoming: [], outgoing: [] },
      groups: [],
      today: deviceLocalDate(new Date()),
    });
    expect(model.gardensAreExamples).toBe(false);
    const examples = buildFriendsModel({
      isDemonstration: true,
      friends,
      requests: { incoming: [], outgoing: [] },
      groups: [],
      today: deviceLocalDate(new Date()),
    });
    expect(examples.gardensAreExamples).toBe(true);
  });
});

describe('adding a friend', () => {
  it('has no search by name: only codes and QR codes (owner decision)', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, addFriendPage()));
    await screen.findByTestId('add-qr-code');
    expect(screen.queryByLabelText('Nom à chercher')).toBeNull();
    expect(screen.queryByText(/Par son nom/)).toBeNull();
  });

  it('shows my QR code, then my code, then their code with the scanner beside it (5b)', async () => {
    setDeviceConditions({ fontScale: 1 });
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, addFriendPage()));
    await screen.findByTestId('add-qr-code');
    expect(screen.getByText('Ton proche le scanne depuis Jannatuk.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Avec son code' })).toBeOnTheScreen();
    const field = screen.getByLabelText('Code d’invitation');
    const scan = screen.getByRole('button', { name: 'Scanner un QR code' });
    let row = field.parent;
    while (row !== null && !row.queryAll(() => true).includes(scan)) row = row.parent;
    expect(row).toHaveStyle({ flexDirection: 'row' });
    const page = screen.getByTestId('add-friend');
    const order = page.queryAll(
      ({ props }) =>
        props.testID === 'add-qr' || props.testID === 'add-my-code' || props.testID === 'add-code',
    );
    expect(order.map(({ props }) => props.testID)).toEqual(['add-qr', 'add-my-code', 'add-code']);
  });

  it('shows my code in two groups and shares it through the system share sheet', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const share = jest.fn(async () => undefined);
    await render(withStore(store, addFriendPage({ share })));
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
    await render(withStore(store, addFriendPage({ openFriend })));
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

  it('draws my invitation as a QR code that carries the link of my code', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, addFriendPage()));
    const qr = await screen.findByRole('image', { name: 'QR code de mon invitation' });
    expect(qr).toBeOnTheScreen();
    // The code drawn is the code shown in "Mon code", as the link the scanner reads back.
    const myCode = store.invite()?.code;
    if (myCode === undefined) throw new Error('No invitation was made.');
    expect(screen.getByTestId('add-my-code')).toHaveTextContent(
      new RegExp(`${myCode.slice(0, 4)} ${myCode.slice(4)}`),
    );
    // The path drawn, read back module by module, is the code of that link.
    const path = screen.container.queryAll(({ type }) => type === 'RNSVGPath')[0];
    expect(modulesOfPath(String(path?.props.d), qrCodeModules(inviteLink(myCode)).length)).toEqual(
      qrCodeModules(inviteLink(myCode)),
    );
    expect(parseInviteLink(inviteLink(myCode))).toBe(myCode);
    expect(screen.queryByText(/Démonstration/)).toBeNull();
  });

  it('asks for the camera only when the person taps Scanner, then opens the scanner', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const openScanner = jest.fn();
    await render(withStore(store, addFriendPage({ openScanner })));
    await screen.findByTestId('add-qr-code');
    expect(cameraQuestionsShown()).toBe(0);

    await fireEvent.press(screen.getByRole('button', { name: 'Scanner un QR code' }));
    await waitFor(() => expect(openScanner).toHaveBeenCalledTimes(1));
    expect(cameraQuestionsShown()).toBe(1);
  });

  it('opens the scanner without asking again when the camera was refused before', async () => {
    setCamera('denied');
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const openScanner = jest.fn();
    await render(withStore(store, addFriendPage({ openScanner })));
    await fireEvent.press(await screen.findByRole('button', { name: 'Scanner un QR code' }));
    await waitFor(() => expect(openScanner).toHaveBeenCalledTimes(1));
    expect(cameraQuestionsShown()).toBe(0);
  });

  it('fills the code field from a link of invitation, and accepts it only on the button', async () => {
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const invite = await demo.repositoryAs(DEMO_USERS.yacine).createInvite();
    const openFriend = jest.fn();
    await render(withStore(store, addFriendPage({ openFriend, linkedCode: invite.code })));
    const field = await screen.findByLabelText('Code d’invitation');
    expect(field).toHaveDisplayValue(`${invite.code.slice(0, 4)} ${invite.code.slice(4)}`);
    expect(openFriend).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter ce proche' }));
    await waitFor(() => expect(openFriend).toHaveBeenCalledWith(DEMO_USERS.yacine));
  });

  it('drops a link whose code is not well formed', async () => {
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, addFriendPage({ linkedCode: 'abcd efgh; drop' })));
    expect(await screen.findByLabelText('Code d’invitation')).toHaveDisplayValue('');
  });
});

describe('scanning a QR code', () => {
  it('adds the friend whose invitation it reads: the same rules as a typed code', async () => {
    setCamera('granted');
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const invite = await demo.repositoryAs(DEMO_USERS.yacine).createInvite();
    const openFriend = jest.fn();
    await render(withStore(store, <ScanInvitePage openFriend={openFriend} />));
    const preview = await cameraReads(inviteLink(invite.code));
    expect(preview.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
    await waitFor(() => expect(openFriend).toHaveBeenCalledWith(DEMO_USERS.yacine));
    expect(cameraQuestionsShown()).toBe(0);
  });

  it('says when a QR code is not an invitation, and keeps looking', async () => {
    setCamera('granted');
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    const openFriend = jest.fn();
    await render(withStore(store, <ScanInvitePage openFriend={openFriend} />));
    await screen.findByText(
      'Vise le QR code de ton proche : il est ajouté dès que le code est lu.',
    );
    // A link with a path after the code is not an invitation: nothing is trimmed (rule 6).
    await cameraReads('https://example.com/quranapp://invite/ABCDEFGH');
    expect(
      await screen.findByText('Ce QR code n’est pas une invitation Jannatuk.'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('camera-view')).toBeOnTheScreen();
    expect(openFriend).not.toHaveBeenCalled();
  });

  it('says what the rules refuse: my own code', async () => {
    setCamera('granted');
    await showLanguage('fr');
    const { store, demo } = await signedInDemoForTest();
    const mine = await demo.repository.createInvite();
    await render(withStore(store, <ScanInvitePage openFriend={jest.fn()} />));
    await cameraReads(inviteLink(mine.code));
    expect(await screen.findByText('C’est ton propre code.')).toBeOnTheScreen();
  });

  it('explains a refused camera and leads to Settings, without asking again', async () => {
    setCamera('denied');
    await showLanguage('fr');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <ScanInvitePage openFriend={jest.fn()} />));
    expect(await screen.findByTestId('scan-denied')).toBeOnTheScreen();
    expect(screen.getByText('Accès à l’appareil photo désactivé')).toBeOnTheScreen();
    expect(
      screen.getByText('Tu peux aussi taper son code sur la page précédente.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('camera-view')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ouvrir les réglages' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(cameraQuestionsShown()).toBe(0);
    openSettings.mockRestore();
  });

  it('shows the camera once it was allowed in Settings and the person comes back', async () => {
    setCamera('denied');
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <ScanInvitePage openFriend={jest.fn()} />));
    await screen.findByTestId('scan-denied');
    setCamera('granted');
    // AppState is a mock of the React Native preset: the page's listener is among its calls.
    const listeners = jest
      .mocked(AppState.addEventListener)
      .mock.calls.filter(([event]) => event === 'change')
      .map(([, listener]) => listener);
    await act(async () => {
      for (const listener of listeners) listener('active');
    });
    expect(await screen.findByTestId('camera-view')).toBeOnTheScreen();
  });

  it('asks with a single Continuer button when the camera was never asked about', async () => {
    setCamera('undetermined');
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <ScanInvitePage openFriend={jest.fn()} />));
    expect(await screen.findByTestId('scan-ask')).toBeOnTheScreen();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByTestId('camera-view')).toBeOnTheScreen();
    expect(cameraQuestionsShown()).toBe(1);
  });

  it('says when the camera cannot start', async () => {
    setCamera('granted');
    await showLanguage('fr');
    const { store } = await signedInDemoForTest();
    await render(withStore(store, <ScanInvitePage openFriend={jest.fn()} />));
    await fireEvent(await screen.findByTestId('camera-view'), 'mountError', { message: 'busy' });
    expect(await screen.findByText('L’appareil photo ne démarre pas')).toBeOnTheScreen();
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
