/**
 * The first screen of a friend's page is the part the bars leave visible (maquettes 2026-11-26,
 * "friend"): the garden fills it down to the card, and the card rests just above the tab bar, its
 * two buttons on screen without scrolling. That part is measured after the first layout: until
 * then it is the window under both bars, never flat (the 683ad8d pictures showed an empty area
 * where the garden belongs).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HeaderHeightContext } from 'expo-router/react-navigation';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { DEMO_USERS } from '@/data/social';
import { deviceLocalDate } from '@/features/home';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { resetDeviceConditions, setDeviceConditions } from '@/ui/test-support/environment';

import { FriendScreen } from '../friend-screen';
import { buildFriendPageModel } from '../friends-model';
import { signedInDemoForTest } from '../test-support/demo';

jest.mock(
  'expo-camera',
  () =>
    jest.requireActual<typeof import('../test-support/camera')>('../test-support/camera')
      .fakeExpoCamera,
);

const noop = () => undefined;

/** An iPhone's bars: the navigation bar with the status bar, the tab bar with the home indicator. */
const HEADER = 103;
const TAB_BAR = 83;
/** The window of `setDeviceConditions`. */
const WINDOW_HEIGHT = 844;

afterEach(resetDeviceConditions);

async function renderFriend() {
  setDeviceConditions();
  await showLanguage('fr');
  const { demo } = await signedInDemoForTest();
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 59, right: 0, bottom: TAB_BAR, left: 0 }}>
      <HeaderHeightContext.Provider value={HEADER}>
        <FriendScreen
          model={buildFriendPageModel({
            isDemonstration: true,
            view: await demo.repository.getPersonView(DEMO_USERS.mustapha),
            encouragedToday: false,
            today: deviceLocalDate(new Date()),
          })}
          refusal={null}
          actions={{ encourage: noop, remove: noop, block: noop }}
        />
      </HeaderHeightContext.Provider>
    </SafeAreaInsetsContext.Provider>,
  );
}

const minHeightOfFirstScreen = () =>
  StyleSheet.flatten(screen.getByTestId('friend-first-screen').props.style).minHeight;

describe("a friend's page, its first screen between the bars", () => {
  it('is the window under both bars before the page has been measured, never flat', async () => {
    await renderFriend();
    expect(minHeightOfFirstScreen()).toBe(WINDOW_HEIGHT - HEADER - TAB_BAR);
  });

  it('takes the measured page less the navigation bar and the tab bar', async () => {
    await renderFriend();
    await fireEvent(screen.getByTestId('friend'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: WINDOW_HEIGHT } },
    });
    expect(minHeightOfFirstScreen()).toBe(WINDOW_HEIGHT - HEADER - TAB_BAR);
  });

  it('keeps the scroll clear of both bars, so the card is never under the tab bar', async () => {
    await renderFriend();
    const content = StyleSheet.flatten(
      screen.getByTestId('friend-scroll').props.contentContainerStyle,
    );
    expect(content.paddingTop).toBe(HEADER);
    expect(Number(content.paddingBottom)).toBeGreaterThanOrEqual(TAB_BAR);
  });

  it('shows the card with both buttons in the first screen, above the tab bar', async () => {
    await renderFriend();
    const first = screen.getByTestId('friend-first-screen');
    const card = screen.getByTestId('friend-card');
    expect(first.queryAll(() => true)).toContain(card);
    expect(card.queryAll(() => true)).toContain(screen.getByTestId('friend-encourage'));
    expect(card.queryAll(() => true)).toContain(screen.getByTestId('friend-read'));
  });
});
