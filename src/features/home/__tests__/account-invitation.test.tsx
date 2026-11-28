/**
 * The account invitation over a new garden (docs/specs/account-invitation.md): when it opens, that
 * it opens once, and that it stays shut while the sign-in providers are not set up.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createMemoryStorage } from '@/data/storage';
import { demoForTest, withStore } from '@/features/friends/test-support/demo';
import { showLanguage } from '@/features/garden/test-support/screen-conditions';
import type { KeyValueStorage } from '@/store';
import { resetDeviceConditions } from '@/ui/test-support/environment';

import appJson from '../../../../app.json';

import {
  ACCOUNT_INVITATION_DELAY_MS,
  ACCOUNT_INVITATION_SEEN_KEY,
  AccountInvitation,
  readAccountInvitationFlag,
  type AccountInvitationProps,
} from '../account-invitation';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

afterEach(async () => {
  jest.useRealTimers();
  await resetDeviceConditions();
});

describe('the accountInvitation feature flag', () => {
  it('is on only when app.json extra says so with a real true', () => {
    expect(readAccountInvitationFlag({ features: { accountInvitation: true } })).toBe(true);
    expect(readAccountInvitationFlag({ features: { accountInvitation: false } })).toBe(false);
    expect(readAccountInvitationFlag({ features: { accountInvitation: 'true' } })).toBe(false);
    expect(readAccountInvitationFlag({ features: {} })).toBe(false);
    expect(readAccountInvitationFlag({})).toBe(false);
    expect(readAccountInvitationFlag(undefined)).toBe(false);
    expect(readAccountInvitationFlag(null)).toBe(false);
    expect(readAccountInvitationFlag('on')).toBe(false);
  });

  // On since 27 November 2026 (owner: "ne cache rien du tout"): its buttons say "Bientôt
  // disponible" until the providers are set up (docs/AUTH-SETUP.md).
  it('is on in app.json: the owner sees every screen while he tests', () => {
    expect(appJson.expo.extra.features.accountInvitation).toBe(true);
  });
});

async function settle() {
  // Lets the promise of the storage answer.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderInvitation(props: Partial<AccountInvitationProps> = {}) {
  const { demo, store } = demoForTest();
  const storage: KeyValueStorage = props.storage ?? createMemoryStorage();
  const onOpenEmail = jest.fn();
  await showLanguage('fr');
  await render(
    withStore(
      store,
      <AccountInvitation
        enabled
        requested
        gardenShown
        onOpenEmail={onOpenEmail}
        storage={storage}
        {...props}
      />,
    ),
  );
  await settle();
  return { demo, store, storage, onOpenEmail };
}

async function waitForTheGarden() {
  await act(async () => {
    jest.advanceTimersByTime(ACCOUNT_INVITATION_DELAY_MS);
  });
  await settle();
}

describe('when the invitation opens', () => {
  beforeEach(() =>
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] }),
  );

  it('rises 0.8 seconds after the garden is shown, not before', async () => {
    await renderInvitation();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(ACCOUNT_INVITATION_DELAY_MS - 1);
    });
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('account-invitation')).toBeOnTheScreen();
    expect(ACCOUNT_INVITATION_DELAY_MS).toBe(800);
  });

  it('never opens while the flag is off, and remembers nothing', async () => {
    const { storage } = await renderInvitation({ enabled: false });
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    expect(await storage.getItem(ACCOUNT_INVITATION_SEEN_KEY)).toBeNull();
  });

  it('never opens when the home was not opened from "Créer mon jardin"', async () => {
    await renderInvitation({ requested: false });
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('waits for the garden: nothing rises over a screen that is not ready', async () => {
    await renderInvitation({ gardenShown: false });
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('does not open for someone who is already signed in', async () => {
    const { demo, store } = demoForTest();
    await demo.auth.signInWithApple();
    await showLanguage('fr');
    await render(
      withStore(
        store,
        <AccountInvitation
          enabled
          requested
          gardenShown
          onOpenEmail={jest.fn()}
          storage={createMemoryStorage()}
        />,
      ),
    );
    await settle();
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('opens once: it is remembered as seen as soon as it is shown', async () => {
    const { storage } = await renderInvitation();
    await waitForTheGarden();
    expect(screen.getByTestId('account-invitation')).toBeOnTheScreen();
    expect(await storage.getItem(ACCOUNT_INVITATION_SEEN_KEY)).toBe('1');
  });

  it('does not open again at a later launch', async () => {
    const storage = createMemoryStorage({ [ACCOUNT_INVITATION_SEEN_KEY]: '1' });
    await renderInvitation({ storage });
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('does not open when the storage cannot be read: no invitation rather than one every time', async () => {
    const storage = {
      getItem: () => Promise.reject(new Error('disk')),
      setItem: () => Promise.resolve(),
      removeItem: () => Promise.resolve(),
    };
    await renderInvitation({ storage });
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('does not come back after "Plus tard", even if the home asks again', async () => {
    await renderInvitation();
    await waitForTheGarden();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    expect(screen.queryByTestId('account-invitation')).toBeNull();
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });

  it('does not come back when the garden leaves the screen and returns (the reader opens over it)', async () => {
    const { store } = demoForTest();
    const storage = createMemoryStorage();
    await showLanguage('fr');
    const tree = (gardenShown: boolean) =>
      withStore(
        store,
        <AccountInvitation
          enabled
          requested
          gardenShown={gardenShown}
          onOpenEmail={jest.fn()}
          storage={storage}
        />,
      );
    const view = await render(tree(true));
    await settle();
    await waitForTheGarden();
    await fireEvent.press(screen.getByRole('button', { name: 'Plus tard' }));
    await view.rerender(tree(false));
    await view.rerender(tree(true));
    await waitForTheGarden();
    expect(screen.queryByTestId('account-invitation')).toBeNull();
  });
});
