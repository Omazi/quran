import { useEffect, useState } from 'react';

import { LEVEL_1_ART, type GardenArt } from '../garden-art';
import { readGardenModel, type GardenModel } from './garden-model';
import { parseGlb } from './glb';

/** What the 3D garden has to draw: nothing yet, the model, or nothing ever (the picture stays). */
export type GardenModelStatus =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: GardenModel }
  | { readonly status: 'failed' };

const shared = new Map<string, Promise<GardenModel>>();

/**
 * A garden's model, read once for the whole app: the home screen and a friend's page share it.
 * A failure is not kept, so that a later screen can try again.
 */
export function loadGardenModel(art: GardenArt = LEVEL_1_ART): Promise<GardenModel> {
  let model = shared.get(art.key);
  if (model === undefined) {
    model = art
      .loadModel()
      .then((bytes) => readGardenModel(parseGlb(bytes)))
      .catch((error: unknown) => {
        shared.delete(art.key);
        throw error;
      });
    shared.set(art.key, model);
  }
  return model;
}

/** For tests: forget the models read. */
export function forgetGardenModel(): void {
  shared.clear();
}

export function useGardenModel(art: GardenArt = LEVEL_1_ART): GardenModelStatus {
  const [status, setStatus] = useState<GardenModelStatus>({ status: 'loading' });
  useEffect(() => {
    let isCurrent = true;
    setStatus({ status: 'loading' });
    loadGardenModel(art).then(
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
  }, [art]);
  return status;
}
