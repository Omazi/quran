import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createDemoSocial } from '@/data/social';
import type { LocalDate } from '@/domain/shared/local-date';
import type { AuthGateway, Invite, SocialRepository, UserId } from '@/domain/social';
import { deviceLocalDate } from '@/features/home';

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

export function createSocialStore(client: SocialClient): SocialStore {
  const listeners = new Set<() => void>();
  let version = 0;
  let invite: Invite | null = null;
  return {
    client,
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
