import type { ReactElement } from 'react';

import { createDemoSocial, type DemoSocial } from '@/data/social';
import { deviceLocalDate } from '@/features/home';

import {
  createSocialStore,
  replaceAppSocialStore,
  SocialProvider,
  type SocialStore,
  type SocialStoreOptions,
} from '../social-store';

/**
 * A fresh demonstration for one test, dated like the screens date it (the device's day), so that
 * "watered today" means the same day on both sides.
 */
export function demoForTest(options?: SocialStoreOptions): {
  demo: DemoSocial;
  store: SocialStore;
} {
  const demo = createDemoSocial({ today: () => deviceLocalDate(new Date()) });
  // The sign-in of the demonstration itself is what most tests try: its providers answer. The
  // "Bientôt disponible" of this build is tested on its own (providersReady: false).
  return { demo, store: createSocialStore(demo, { providersReady: true, ...options }) };
}

export async function signedInDemoForTest(
  options?: SocialStoreOptions,
): Promise<{ demo: DemoSocial; store: SocialStore }> {
  const made = demoForTest(options);
  await made.demo.auth.signInWithApple();
  return made;
}

export function withStore(store: SocialStore, tree: ReactElement): ReactElement {
  return <SocialProvider store={store}>{tree}</SocialProvider>;
}

/**
 * A fresh demonstration as the one the whole app runs on (the routes have no provider): for
 * tests that open the app, so that no session or friend is left over from another test.
 */
export function freshAppDemoForTest(options?: SocialStoreOptions): {
  demo: DemoSocial;
  store: SocialStore;
} {
  const made = demoForTest(options);
  replaceAppSocialStore(made.store);
  return made;
}
