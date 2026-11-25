/**
 * The home screen, the "Jardin" tab (docs/specs/ui-lot1.md, section B): the screen, which shows a
 * model, the pure function that builds the model, and the hook that wires the two to the data.
 * Everything else in this folder is private.
 */

export { newArrival, type Arrival } from './arrival';
export {
  buildHomeModel,
  type HomeActions,
  type HomeCompletedKhatma,
  type HomeDrought,
  type HomeHizb,
  type HomeLayout,
  type HomeWaterRun,
  type HomeModel,
  type HomeModelInput,
  type HomeNotice,
  type HomeReading,
  type HomeReadyModel,
  type HomeSettings,
  type HomeSource,
  type HomeUnavailableModel,
} from './home-model';
export { HomeScreen, type HomeScreenProps } from './home-screen';
export {
  buildHomeModelOrUnavailable,
  useHomeModel,
  type HomeModelDependencies,
  type HomeModelResult,
} from './use-home-model';
export { deviceLocalDate, useToday, type Clock } from './use-today';
export { useHomeScreen, type HomeScreenData } from './use-home-screen';
export type { NeighbourGarden, NeighbourGardens } from './neighbours';
