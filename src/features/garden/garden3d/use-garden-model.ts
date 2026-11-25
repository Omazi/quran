import { useEffect, useState } from 'react';

import { readGardenModel, type GardenModel } from './garden-model';
import { parseGlb } from './glb';
import { loadGardenModelBytes } from './load-garden-model';

/** What the 3D garden has to draw: nothing yet, the model, or nothing ever (the picture stays). */
export type GardenModelStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: GardenModel }
  | { readonly status: 'failed' };

let shared: Promise<GardenModel> | null = null;

/**
 * The garden model, read once for the whole app: the home screen and a friend's page share it.
 * A failure is not kept, so that a later screen can try again.
 */
export function loadGardenModel(
  load: () => Promise<ArrayBuffer> = loadGardenModelBytes,
): Promise<GardenModel> {
  if (shared === null) {
    shared = load()
      .then((bytes) => readGardenModel(parseGlb(bytes)))
      .catch((error: unknown) => {
        shared = null;
        throw error;
      });
  }
  return shared;
}

/** For tests: forget the model read. */
export function forgetGardenModel(): void {
  shared = null;
}

export function useGardenModel(): GardenModelStatus {
  const [status, setStatus] = useState<GardenModelStatus>({ status: 'loading' });
  useEffect(() => {
    let isCurrent = true;
    loadGardenModel().then(
      (model) => {
        if (isCurrent) setStatus({ status: 'ready', model });
      },
      (error: unknown) => {
        console.warn('The 3D garden could not be loaded; the picture stays.', error);
        if (isCurrent) setStatus({ status: 'failed' });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, []);
  return status;
}
