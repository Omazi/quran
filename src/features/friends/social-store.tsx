import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createDemoSocial } from '@/data/social';
import type { LocalDate } from '@/domain/shared/local-date';
import type { AuthGateway, Invite, SocialRepository, UserId } from '@/domain/social';
import { deviceLocalDate } from '@/features/home';

import { isFriendsSignInEnabled } from './sign-in-flag';

/**
 * Where the Proches tab gets its accounts and friends. Today a demonstration (D33); the day the
 * server exists, a second implementation of the same two interfaces takes its place here and no
 * screen changes (docs/specs/social.md, section 4).
 */
export interface SocialClient {
  readonly isDemonstration: boolean;
  readonly auth: AuthGateway;
  readonly repository: SocialRepository;
}

/**
 * The client, and what the screens share while the app is open: a counter that changes after
 * every action, so that each screen reads again what it shows, and two things the repository
 * does not give back.
 */
export interface SocialStore {
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
}

export interface SocialStoreOptions {
  /** Defaults to this build's `friendsSignIn` flag. */
  readonly showsSignIn?: boolean;
}

export function createSocialStore(
  client: SocialClient,
  { showsSignIn = isFriendsSignInEnabled() }: SocialStoreOptions = {},
): SocialStore {
  const listeners = new Set<() => void>();
  let version = 0;
  let invite: Invite | null = null;
  return {
    client,
    showsSignIn,
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

/** The demonstration the app runs on: created once, on the first visit to the tab. */
function appSocialStore(): SocialStore {
  if (appStore === null) {
    appStore = createSocialStore(createDemoSocial({ today: () => deviceLocalDate(new Date()) }));
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
