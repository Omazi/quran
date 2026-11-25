/**
 * The sync of the progress with the person's account (docs/specs/sync.md): the engine that
 * moves the events, the server it talks to (Supabase, or one in memory), and the corrected clock.
 */
import type { SyncBackend } from '@/domain/sync';
import type { AppStore } from '@/store';

import { createSupabaseSyncBackend } from './supabase-backend';
import {
  readBuildEnvironment,
  readSupabaseConfig,
  type SupabaseEnvironment,
} from './supabase-config';
import type { SyncClock } from './sync-clock';
import { createSyncEngine, type SyncEngine } from './sync-engine';

export {
  createMemorySyncBackend,
  type MemoryServerRow,
  type MemorySyncBackend,
  type MemorySyncBackendOptions,
} from './memory-backend';
export { createSupabaseSyncBackend, type SupabaseSyncBackendOptions } from './supabase-backend';
export {
  readAppConfigEnvironment,
  readBuildEnvironment,
  readSupabaseConfig,
  type SupabaseConfig,
  type SupabaseEnvironment,
} from './supabase-config';
export { createSyncClock, type SyncClock } from './sync-clock';
export {
  createSyncEngine,
  type SyncEngine,
  type SyncEngineOptions,
  type SyncStatus,
} from './sync-engine';

/** The signed-in person, as the authentication gives it (Supabase Auth, once it exists). */
export interface SyncSession {
  /** The account id (`auth.users.id`), or null when nobody is signed in. */
  readonly getAccount: () => Promise<string | null>;
  /** The session's access token, or null. */
  readonly getAccessToken: () => Promise<string | null>;
}

export interface DeviceSyncOptions {
  readonly store: AppStore;
  readonly clock: SyncClock;
  /**
   * The real sign-in. Null until the authentication with Supabase exists: the sign-in of the
   * demonstration (src/data/social) is not an account and must never sync.
   */
  readonly session: SyncSession | null;
  /** Defaults to this build's public environment. */
  readonly environment?: SupabaseEnvironment;
}

/**
 * The sync of this phone: with the Supabase project when the build has its address and key and
 * someone is signed in, otherwise none (the progress stays on the phone, and the settings say so).
 */
export function createDeviceSync({
  store,
  clock,
  session,
  environment = readBuildEnvironment(),
}: DeviceSyncOptions): SyncEngine {
  const config = readSupabaseConfig(environment);
  const backend: SyncBackend | null =
    config === null || session === null
      ? null
      : createSupabaseSyncBackend({ config, getAccessToken: session.getAccessToken });
  return createSyncEngine({
    store,
    backend,
    clock,
    getAccount: session?.getAccount ?? (async () => null),
  });
}
