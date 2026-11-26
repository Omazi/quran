import { useEffect, useState } from 'react';

import { useSession } from './use-session';
import { useSocialStore, useSocialVersion } from './social-store';

/**
 * The name the signed-in person gave their account, or null when signed out or not yet read.
 * What the picture of a shared badge may carry, if the person says yes (never by default).
 */
export function useSelfDisplayName(): string | null {
  const session = useSession();
  const store = useSocialStore();
  const version = useSocialVersion(store);
  const [name, setName] = useState<string | null>(null);
  const isSignedIn = session.status === 'signed-in';
  useEffect(() => {
    if (!isSignedIn) return undefined;
    let isCurrent = true;
    store.client.repository.getMyProfile().then(
      (profile) => isCurrent && setName(profile.displayName),
      () => isCurrent && setName(null),
    );
    return () => {
      isCurrent = false;
    };
  }, [isSignedIn, store, version]);
  // Signed out, no name, whatever was read before.
  return isSignedIn ? name : null;
}
