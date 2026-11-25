/**
 * The one door to a speech engine for the listening screens (docs/DECISIONS.md, D42).
 *
 * - A published build listens with the real engine of the phone (`@/data/speech`: the native
 *   microphone and Whisper). Where the app has no real engine (the web, Android for now), there
 *   is none, and the route sends the address home.
 * - In development (`__DEV__`) and in a test build made with `EXPO_PUBLIC_STATE_PREVIEW=1`
 *   (docs/BUILD.md), the SIMULATED engine is also there, for the tests and the screenshots: it
 *   plays the scenario named in the address (`/listening?scenario=several`), and stands in for
 *   the real engine where there is none (the web, Expo Go).
 *
 * Both flags are known when the bundle is built, so a published bundle loses the branch below and
 * the simulation with it (docs/specs/listening.md, section 2: it never serves in the published
 * version). The condition must stay written out next to the `require`, or the bundler could not
 * drop it.
 */
import { createDeviceSpeechEngine } from '@/data/speech';
import type { SpeechEngine } from '@/domain/listening';

type Simulation = typeof import('./simulated/scenarios');

const simulation: Simulation | null =
  __DEV__ || process.env.EXPO_PUBLIC_STATE_PREVIEW === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./simulated/scenarios') as Simulation)
    : null;

/**
 * A new engine for finding a passage (`/listening`): the scenario named in the address where the
 * simulation is there, otherwise the phone's own engine; null when there is neither.
 */
export function createListeningEngine(scenario: string | undefined): SpeechEngine | null {
  if (simulation !== null && scenario !== undefined) {
    return simulation.createScenarioEngine(simulation.parseScenario(scenario));
  }
  const device = createDeviceSpeechEngine('search');
  if (device !== null || simulation === null) return device;
  return simulation.createScenarioEngine(simulation.parseScenario(undefined));
}

/**
 * A new engine for following a recitation (`/voice-follow`): the simulated recitation of 18:10
 * when the address names a scenario and the simulation is there, otherwise the phone's own
 * engine, or the simulation where the phone has none; null when there is neither.
 */
export function createFollowEngine(scenario: string | undefined): SpeechEngine | null {
  if (simulation !== null && scenario !== undefined) {
    return simulation.createScenarioEngine('follow');
  }
  const device = createDeviceSpeechEngine('follow');
  if (device !== null || simulation === null) return device;
  return simulation.createScenarioEngine('follow');
}
