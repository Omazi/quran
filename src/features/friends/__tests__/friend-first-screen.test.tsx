/**
 * The garden area of a friend's page takes the height between the bar and the card. That height
 * comes from the measure of the scroll view, which arrives after the first layout: until then the
 * area must not be flat (the 683ad8d pictures showed an empty area where the garden belongs).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { DEMO_USERS } from '@/data/social';
import { deviceLocalDate } from '@/features/home';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';

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

async function renderFriend() {
  await showLanguage('fr');
  const { demo } = await signedInDemoForTest();
  await render(
    <FriendScreen
      model={buildFriendPageModel({
        isDemonstration: true,
        view: await demo.repository.getPersonView(DEMO_USERS.mustapha),
        encouragedToday: false,
        today: deviceLocalDate(new Date()),
      })}
      refusal={null}
      actions={{ encourage: noop, remove: noop, block: noop }}
    />,
  );
}

const minHeightOfFirstScreen = () =>
  StyleSheet.flatten(screen.getByTestId('friend-first-screen').props.style).minHeight;

describe("a friend's page, its garden area before and after the first measure", () => {
  it('is not flat before the scroll view has been measured', async () => {
    await renderFriend();
    expect(minHeightOfFirstScreen()).toBeGreaterThan(0);
  });

  it('takes the measured height of the scroll view once it is known', async () => {
    await renderFriend();
    const scroller = screen.getByTestId('friend-scroll');
    await fireEvent(scroller, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 612 } },
    });
    expect(minHeightOfFirstScreen()).toBe(612);
  });
});
