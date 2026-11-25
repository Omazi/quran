/**
 * The one door to the SIMULATED speech engine (docs/specs/listening.md, section 2: it never
 * serves in the published version).
 *
 * Open in development (`__DEV__`) and in a test build made with `EXPO_PUBLIC_STATE_PREVIEW=1`
 * (docs/BUILD.md), the same door as the home screen's state preview. Both are known when the
 * bundle is built, so a published bundle loses the branch below and the simulation with it. The
 * condition must stay written out next to the `require`, or the bundler could not drop it.
 *
 * Behind a closed door there is no engine: the real one (D5) is not in this lot, so the listening
 * screen does not exist in a published build.
 */
import type { SpeechEngine } from '@/domain/listening';

type Simulation = typeof import('./simulated/scenarios');

const simulation: Simulation | null =
  __DEV__ || process.env.EXPO_PUBLIC_STATE_PREVIEW === '1'
    ? // A conditional `require` is the only form the bundler can leave out; it has no type of its own.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('./simulated/scenarios') as Simulation)
    : null;

/**
 * A new engine for the listening screen: the simulated one, playing the scenario named in the
 * address, where the door is open; null in a published build.
 */
export function createTrialEngine(scenario: string | undefined): SpeechEngine | null {
  if (simulation === null) return null;
  return simulation.createScenarioEngine(simulation.parseScenario(scenario));
}
