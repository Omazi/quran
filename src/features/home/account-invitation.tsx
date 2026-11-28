import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/friends';
import type { KeyValueStorage } from '@/store';

import { AccountInvitationSheet } from './account-invitation-sheet';

/** Remembered as soon as the invitation is shown: it is offered once. */
export const ACCOUNT_INVITATION_SEEN_KEY = 'account-invitation-seen';

/** The garden appears first and is seen for a moment; the sheet rises over it after this long. */
export const ACCOUNT_INVITATION_DELAY_MS = 800;

/**
 * The feature flag `accountInvitation` of app.json (`expo.extra.features`): true only when it is
 * a real `true`. It stays false while Supabase's sign-in providers are not set up
 * (docs/AUTH-SETUP.md): the owner does not ship a feature that cannot work, so the sheet exists
 * and is tested but is not shown to anyone.
 */
export function readAccountInvitationFlag(extra: unknown): boolean {
  if (typeof extra !== 'object' || extra === null) return false;
  const { features } = extra as { features?: unknown };
  if (typeof features !== 'object' || features === null) return false;
  return (features as { accountInvitation?: unknown }).accountInvitation === true;
}

/** The flag of this build. */
export function isAccountInvitationEnabled(): boolean {
  return readAccountInvitationFlag(Constants.expoConfig?.extra);
}

/**
 * The device's storage, loaded when the invitation first needs it rather than with the module
 * (as the garden hint does): where it does not exist, the invitation is simply not shown.
 */
export function deviceStorageOrNull(): KeyValueStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@/data/storage') as typeof import('@/data/storage')).deviceStorage;
  } catch {
    return null;
  }
}

export interface AccountInvitationTiming {
  /** The home was opened with `?welcome=1`, from "Créer mon jardin". */
  readonly requested: boolean;
  /** The garden is on the screen. */
  readonly gardenShown: boolean;
  /** Nobody is signed in: someone who is has nothing to be invited to. */
  readonly isSignedOut: boolean;
  readonly storage: KeyValueStorage | null;
  readonly delayMs?: number;
}

/**
 * Whether the invitation is open: once the home was requested for a new garden, the garden is
 * shown, nobody is signed in and it was never seen, after `delayMs`. It is remembered as seen the
 * moment it opens, and `dismiss` closes it for good. An unreadable storage means no invitation
 * rather than one at every launch.
 */
export function useAccountInvitation({
  requested,
  gardenShown,
  isSignedOut,
  storage,
  delayMs = ACCOUNT_INVITATION_DELAY_MS,
}: AccountInvitationTiming): { readonly isOpen: boolean; readonly dismiss: () => void } {
  // undefined while the storage answers, then whether the invitation was seen before.
  const [wasSeen, setWasSeen] = useState<boolean | undefined>(undefined);
  const [isOpen, setOpen] = useState(false);
  // Once opened in this session, never again, whatever the home asks.
  const hasOpened = useRef(false);

  useEffect(() => {
    if (storage === null) return undefined;
    let isCurrent = true;
    storage.getItem(ACCOUNT_INVITATION_SEEN_KEY).then(
      (value) => {
        if (isCurrent) setWasSeen(value !== null);
      },
      () => {
        if (isCurrent) setWasSeen(true);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [storage]);

  const isDue = requested && gardenShown && isSignedOut && wasSeen === false;
  useEffect(() => {
    if (!isDue || hasOpened.current) return undefined;
    const timer = setTimeout(() => {
      hasOpened.current = true;
      storage?.setItem(ACCOUNT_INVITATION_SEEN_KEY, '1').catch(() => undefined);
      setOpen(true);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [isDue, delayMs, storage]);

  const dismiss = useCallback(() => setOpen(false), []);
  // Signing in closes it too: the person has what the invitation offered.
  return { isOpen: isOpen && isSignedOut, dismiss };
}

export interface AccountInvitationProps {
  /** The feature flag; defaults to this build's (`isAccountInvitationEnabled`). */
  readonly enabled?: boolean;
  /** The home was opened with `?welcome=1`. */
  readonly requested: boolean;
  /** The garden is on the screen. */
  readonly gardenShown: boolean;
  /** Opens the e-mail way of the sign-in (the sign-in of the friends tab). */
  readonly onOpenEmail: () => void;
  /** Where "seen" is kept; defaults to the device's. */
  readonly storage?: KeyValueStorage | null;
  readonly delayMs?: number;
}

/**
 * The invitation to create an account, over the new garden (docs/specs/account-invitation.md).
 * Nothing at all happens while the flag is off: not even a look at the session.
 */
export function AccountInvitation({
  enabled = isAccountInvitationEnabled(),
  ...props
}: AccountInvitationProps) {
  return enabled ? <EnabledAccountInvitation {...props} /> : null;
}

function EnabledAccountInvitation({
  requested,
  gardenShown,
  onOpenEmail,
  storage,
  delayMs,
}: Omit<AccountInvitationProps, 'enabled'>) {
  const session = useSession();
  const [deviceStorage] = useState(() => (storage === undefined ? deviceStorageOrNull() : storage));
  const { isOpen, dismiss } = useAccountInvitation({
    requested,
    gardenShown,
    // The anonymous account of the phone is no account the person chose: they are still invited.
    isSignedOut:
      session.status === 'signed-out' ||
      (session.status === 'signed-in' && session.session.provider === 'anonymous'),
    storage: deviceStorage,
    delayMs,
  });
  if (!isOpen) return null;
  return <AccountInvitationSheet onDismiss={dismiss} onOpenEmail={onOpenEmail} />;
}
