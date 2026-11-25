import Constants from 'expo-constants';

/**
 * Where the account's server is: the Supabase project's URL and its public key, read from the
 * public environment of the build (docs/specs/sync.md, "Mise en service"). Both are public by
 * design: anything inside an app can be read. The secret key never goes in the app or the repo.
 */
export interface SupabaseConfig {
  /** `https://<project>.supabase.co`, without a trailing slash. */
  readonly url: string;
  /** The publishable key (`sb_publishable_...`) or, on an older project, the anon key. */
  readonly publicKey: string;
}

/** The environment variables that hold the configuration, as Expo inlines them. */
export interface SupabaseEnvironment {
  readonly url?: string;
  readonly publishableKey?: string;
  readonly anonKey?: string;
}

/** The project written in app.json (`expo.extra.supabase`): public values, in the repo. */
export function readAppConfigEnvironment(extra: unknown): SupabaseEnvironment {
  if (typeof extra !== 'object' || extra === null) return {};
  const supabase = (extra as { supabase?: unknown }).supabase;
  if (typeof supabase !== 'object' || supabase === null) return {};
  const { url, publishableKey } = supabase as { url?: unknown; publishableKey?: unknown };
  return {
    url: typeof url === 'string' ? url : undefined,
    publishableKey: typeof publishableKey === 'string' ? publishableKey : undefined,
  };
}

/**
 * The public environment of this build: the `EXPO_PUBLIC_` variables when the build sets them
 * (they win, to point a test build at another project), otherwise the project of app.json. Each
 * variable is written out in full: Expo only puts in the bundle the `EXPO_PUBLIC_` variables it
 * finds spelled this way.
 */
export function readBuildEnvironment(): SupabaseEnvironment {
  const fromEnvironment: SupabaseEnvironment = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
  if (fromEnvironment.url) return fromEnvironment;
  return readAppConfigEnvironment(Constants.expoConfig?.extra);
}

const KEY_PATTERN = /^[A-Za-z0-9._-]{20,1000}$/;

/**
 * The configuration, or null when there is none or it is malformed: the app then keeps the
 * progress on the phone, and syncs nothing. Only `https` addresses are accepted.
 */
export function readSupabaseConfig(environment: SupabaseEnvironment): SupabaseConfig | null {
  const url = environment.url?.trim().replace(/\/+$/, '');
  const publicKey = (environment.publishableKey ?? environment.anonKey)?.trim();
  if (!url || !publicKey || !KEY_PATTERN.test(publicKey)) return null;
  if (!/^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?$/.test(url)) return null;
  return { url, publicKey };
}
