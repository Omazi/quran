import * as Haptics from 'expo-haptics';

import {
  createExpoHaptics,
  createExpoSounds,
  type ExpoAudioModule,
  type SoundFiles,
} from './device-adapters';
import { createFeedbackService } from './service';
import { appSuppression } from './suppression';

/**
 * The files of the palette, as Metro knows them. Read when the sounds are prepared, not when this
 * module loads (a `require` of an asset is a number, the id Metro gives it).
 */
export function loadSoundFiles(): SoundFiles {
  return {
    drop: require('../../../assets/sounds/drop.m4a') as number,
    plop: require('../../../assets/sounds/plop.m4a') as number,
    grow: require('../../../assets/sounds/grow.m4a') as number,
    open: require('../../../assets/sounds/open.m4a') as number,
    page: require('../../../assets/sounds/page.m4a') as number,
    found: require('../../../assets/sounds/found.m4a') as number,
    splash: require('../../../assets/sounds/splash.m4a') as number,
    celebrate: require('../../../assets/sounds/celebrate.m4a') as number,
    encourage: require('../../../assets/sounds/encourage.m4a') as number,
    error: require('../../../assets/sounds/error.m4a') as number,
  };
}

/**
 * The feedback of the app on the phone. `expo-audio` is loaded when the sounds are first needed,
 * and a build without it stays silent (the haptics still play) instead of failing at launch.
 */
export const deviceFeedback = createFeedbackService({
  haptics: createExpoHaptics(Haptics),
  sounds: createExpoSounds({
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, see above.
    loadAudio: () => require('expo-audio') as ExpoAudioModule,
    loadFiles: loadSoundFiles,
  }),
  suppression: appSuppression,
  now: () => Date.now(),
});
