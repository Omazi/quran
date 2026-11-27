import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { demoForTest, withStore } from '@/features/friends/test-support/demo';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import { pieceSizes } from '@/ui';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import arHome from '../../../i18n/locales/ar/home.json';
import enHome from '../../../i18n/locales/en/home.json';
import frHome from '../../../i18n/locales/fr/home.json';
import { AccountInvitationSheet } from '../account-invitation-sheet';

afterEach(resetDeviceConditions);

async function renderSheet(language: 'fr' | 'en' | 'ar' = 'fr') {
  const { demo, store } = demoForTest();
  const onDismiss = jest.fn();
  const onOpenEmail = jest.fn();
  await showLanguage(language);
  await render(
    withStore(store, <AccountInvitationSheet onDismiss={onDismiss} onOpenEmail={onOpenEmail} />),
  );
  return { demo, store, onDismiss, onOpenEmail };
}

/** A touch of one finger that moved from `fromY` to `y`, as the responder system reports it. */
function touchMoved(fromY: number, y: number, now: number) {
  const touch = {
    touchActive: true,
    startPageX: 0,
    startPageY: 0,
    startTimeStamp: 1,
    currentPageX: 0,
    currentPageY: y,
    currentTimeStamp: now,
    previousPageX: 0,
    previousPageY: fromY,
    previousTimeStamp: now - 1,
  };
  return {
    nativeEvent: { touches: [{ pageX: 0, pageY: y }], pageX: 0, pageY: y, timestamp: now },
    touchHistory: {
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: now,
      numberActiveTouches: 1,
      touchBank: [touch],
    },
  };
}

/**
 * Drags the sheet down by `distance` points and lets go, as the responder system dispatches it:
 * the first move offers the gesture to the sheet (which takes it, and counts from there), the next
 * ones are followed, then the finger lifts.
 */
async function dragDown(distance: number) {
  const handlers = screen.getByTestId('account-invitation').props;
  const firstMove = 20;
  await act(async () => {
    handlers.onMoveShouldSetResponderCapture(touchMoved(0, firstMove, 10));
    expect(handlers.onMoveShouldSetResponder(touchMoved(0, firstMove, 10))).toBe(true);
    handlers.onResponderGrant(touchMoved(0, firstMove, 10));
    handlers.onResponderMove(touchMoved(firstMove, firstMove + distance, 20));
    handlers.onResponderRelease(touchMoved(firstMove + distance, firstMove + distance, 30));
  });
}

describe('the account invitation sheet (prototype, "Ton jardin est prêt.")', () => {
  it('says the garden is ready and what an account is for', async () => {
    await renderSheet();
    expect(screen.getByRole('header', { name: 'Ton jardin est prêt.' })).toBeOnTheScreen();
    expect(
      screen.getByText('Crée un compte pour le retrouver sur tous tes appareils.'),
    ).toBeOnTheScreen();
  });

  it('offers Apple, Google and the e-mail, then a quiet "Plus tard"', async () => {
    await renderSheet();
    expect(screen.getByTestId('sign-in-apple')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-google')).toBeOnTheScreen();
    expect(screen.getByTestId('sign-in-email')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer avec Apple' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer avec Google' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continuer avec un e-mail' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Plus tard' })).toBeOnTheScreen();
  });

  it('puts Apple first on an iPhone', async () => {
    const previous = Platform.OS;
    Platform.OS = 'ios';
    try {
      await renderSheet();
      const labels = screen
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel ?? '')
        .filter((label: string) => label.startsWith('Continuer'));
      expect(labels[0]).toBe('Continuer avec Apple');
    } finally {
      Platform.OS = previous;
    }
  });

  it('signs in with Apple through the sign-in of the friends tab', async () => {
    const { store } = await renderSheet();
    expect(await store.client.auth.getSession()).toBeNull();
    await fireEvent.press(screen.getByTestId('sign-in-apple'));
    await screen.findByTestId('account-invitation');
    expect(await store.client.auth.getSession()).not.toBeNull();
  });

  it('signs in with Google through the same actions', async () => {
    const { store } = await renderSheet();
    await fireEvent.press(screen.getByTestId('sign-in-google'));
    await screen.findByTestId('account-invitation');
    expect(await store.client.auth.getSession()).not.toBeNull();
  });

  it('leads the e-mail way to the sign-in of the friends tab, and closes', async () => {
    const { onOpenEmail, onDismiss } = await renderSheet();
    await fireEvent.press(screen.getByTestId('sign-in-email'));
    expect(onOpenEmail).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('closes with "Plus tard", with the grabber and with a tap outside', async () => {
    const { onDismiss } = await renderSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('closes when dragged down far enough', async () => {
    const { onDismiss } = await renderSheet();
    await dragDown(pieceSizes.sheetDismissDistance + 20);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('springs back when dragged down only a little', async () => {
    const { onDismiss } = await renderSheet();
    await dragDown(pieceSizes.sheetDismissDistance / 3);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('follows the language: English and Arabic', async () => {
    await renderSheet('en');
    expect(screen.getByRole('header', { name: enHome.invitation.title })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: enHome.invitation.later })).toBeOnTheScreen();
  });

  it('has its words in the three languages', () => {
    expect(
      Object.keys(arHome.invitation)
        .filter((key) => !key.endsWith('_female'))
        .sort(),
    ).toEqual(Object.keys(frHome.invitation).sort());
    expect(Object.keys(enHome.invitation).sort()).toEqual(Object.keys(frHome.invitation).sort());
    expect(frHome.invitation.title).toBe('Ton jardin est prêt.');
  });
});
