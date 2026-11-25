import { useCallback, useEffect, useState } from 'react';

import type { KeyValueStorage } from '@/store';

/** Remembered once the person has turned or zoomed a garden: the hint is never shown again. */
export const GARDEN_HINT_KEY = 'garden-3d-hint-seen';

/**
 * The device's storage, loaded when the hint first needs it rather than with the module: a screen
 * drawn where the device storage does not exist (the tests, which give the store a memory
 * storage) simply shows no hint.
 */
function deviceStorageOrNull(): KeyValueStorage | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('@/data/storage') as typeof import('@/data/storage')).deviceStorage;
  } catch {
    return null;
  }
}

/**
 * Whether to show the first-time hint, "Glisse pour tourner, pince pour zoomer" (visite.png), and
 * a way to retire it. Unknown while the storage answers: nothing is shown until then, so the hint
 * never flashes for someone who has already used the garden. Shared by every 3D garden of the app
 * through the storage.
 */
export function useGardenHint(given?: KeyValueStorage): {
  readonly isShown: boolean;
  readonly retire: () => void;
} {
  const [isShown, setShown] = useState(false);
  const [storage] = useState(() => given ?? deviceStorageOrNull());
  useEffect(() => {
    if (storage === null) return undefined;
    let isCurrent = true;
    storage.getItem(GARDEN_HINT_KEY).then(
      (value) => {
        if (isCurrent) setShown(value === null);
      },
      // A storage that cannot answer: no hint rather than one that comes back every time.
      () => undefined,
    );
    return () => {
      isCurrent = false;
    };
  }, [storage]);
  const retire = useCallback(() => {
    setShown((shown) => {
      if (shown && storage !== null) storage.setItem(GARDEN_HINT_KEY, '1').catch(() => undefined);
      return false;
    });
  }, [storage]);
  return { isShown, retire };
}
