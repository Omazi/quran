import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createDemoSocial } from '@/data/social';
import type { LocalDate } from '@/domain/shared/local-date';
import type { AuthGateway, Invite, SocialRepository, UserId } from '@/domain/social';
import { deviceLocalDate } from '@/features/home';

import { appSocialClient } from './anonymous-account';
import { isFriendsSignInEnabled, SIGN_IN_PROVIDERS_READY } from './sign-in-flag';

/**
 * Where the Proches tab gets its accounts and friends: the demonstration (D33), or, with the
 * `friendsAnonymous` flag, the Supabase project with the anonymous account of the phone. Both
 * implement the same two interfaces, and no screen changes (docs/specs/social.md, section 4).
 */
export interface SocialClient {
  readonly isDemonstration: boolean;
  readonly auth: AuthGateway;
  readonly repository: SocialRepository;
  /**
   * Opens a session without any screen, where the client can (the anonymous account, made the
   * first time). Absent: only the sign-in screen opens one (or, in the demonstration, the
   * invented session of `useTabSession`).
   */
  readonly openSilently?: () => Promise<unknown>;
}

/**
 * The client, and what the screens share while the app is open: a counter that changes after
 * every action, so that each screen reads again what it shows, and two things the repository
 * does not give back.
 */
export interface SocialStore {
  /** The current client: the demonstration takes the place of a real one that cannot open. */
  readonly client: SocialClient;
  /**
   * Whether the tab shows its sign-in screen to a person signed out (the `friendsSignIn` flag).
   * When it does not, the demonstration's session opens by itself and the tab goes straight to
   * the friends.
   */
  readonly showsSignIn: boolean;
  subscribe(listener: () => void): () => void;
  version(): number;
  /** Tells every screen that something changed (a request accepted, a group created). */
  changed(): void;
  /** My invitation code of this session, so that each visit does not make a new one. */
  invite(): Invite | null;
  keepInvite(invite: Invite): void;
  /**
   * The day I last encouraged each friend. The repository refuses a second one on the same day
   * (rule 7) but has no way to ask beforehand: the screen remembers what it sent.
   */
  readonly encouraged: Map<UserId, LocalDate>;
  /**
   * Whether Apple, Google and the e-mail really sign in. While they are not set up
   * (docs/AUTH-SETUP.md), their buttons stay visible and say "Bientôt disponible".
   */
  readonly providersReady: boolean;
  /**
   * Why the tab shows the demonstration in a build that wanted real friends: the anonymous
   * account could not be made (switch off in the dashboard, no network, no keychain). One calm
   * line says it; null otherwise.
   */
  notice(): SocialNotice | null;
  /**
   * Replaces a real client that could not open by the demonstration, with the notice; false when
   * there is nothing to fall back to (already the demonstration).
   */
  fallBackToDemo(): boolean;
  /** Whether a demonstration is there to fall back to. */
  readonly hasFallback: boolean;
}

export type SocialNotice = 'not-connected';

export interface SocialStoreOptions {
  /** Defaults to this build's `friendsSignIn` flag. */
  readonly showsSignIn?: boolean;
  /** Defaults to `SIGN_IN_PROVIDERS_READY` (false until docs/AUTH-SETUP.md is done). */
  readonly providersReady?: boolean;
  /** The notice to start with (a build that wanted real friends and cannot have them). */
  readonly notice?: SocialNotice | null;
  /** The demonstration to fall back to when the real client cannot open. */
  readonly fallback?: () => SocialClient;
}

export function createSocialStore(
  initialClient: SocialClient,
  {
    showsSignIn = isFriendsSignInEnabled(),
    providersReady = SIGN_IN_PROVIDERS_READY,
    notice: initialNotice = null,
    fallback,
  }: SocialStoreOptions = {},
): SocialStore {
  const listeners = new Set<() => void>();
  let version = 0;
  let invite: Invite | null = null;
  let client = initialClient;
  let notice = initialNotice;
  return {
    get client() {
      return client;
    },
    showsSignIn,
    providersReady,
    notice: () => notice,
    hasFallback: fallback !== undefined,
    fallBackToDemo() {
      if (fallback === undefined || client.isDemonstration) return false;
      client = fallback();
      notice = 'not-connected';
      invite = null;
      this.changed();
      return true;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
    changed() {
      version += 1;
      listeners.forEach((listener) => listener());
    },
    invite: () => invite,
    keepInvite(next) {
      invite = next;
    },
    encouraged: new Map(),
  };
}

let appStore: SocialStore | null = null;

/**
 * The client the app runs on (the demonstration, or the real tables with the `friendsAnonymous`
 * flag): created once, on the first visit to the tab.
 */
function appSocialStore(): SocialStore {
  if (appStore === null) {
    const today = () => deviceLocalDate(new Date());
    const { client, notice } = appSocialClient(today);
    appStore = createSocialStore(client, {
      notice,
      fallback: () => createDemoSocial({ today }),
    });
  }
  return appStore;
}

/**
 * Replaces the demonstration the app runs on, or forgets it (`null`: a new one on the next
 * visit). For tests of the whole app: the store outlives a render, so each test starts from its
 * own, or the session of one test would be found by the next.
 */
export function replaceAppSocialStore(store: SocialStore | null): void {
  appStore = store;
}

const SocialContext = createContext<SocialStore | null>(null);

/** Gives the pages another store than the app's: tests use it. */
export function SocialProvider({ store, children }: { store?: SocialStore; children: ReactNode }) {
  const [value] = useState(() => store ?? appSocialStore());
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

/**
 * The store of the tab. Without a provider (the routes of the app), the demonstration the app
 * runs on: one for the tab and the pages pushed over it, so that they share a session.
 */
export function useSocialStore(): SocialStore {
  return useContext(SocialContext) ?? appSocialStore();
}

/** A number that changes after every action: a dependency that makes a screen read again. */
export function useSocialVersion(store: SocialStore): number {
  return useSyncExternalStore(store.subscribe, store.version, store.version);
}
