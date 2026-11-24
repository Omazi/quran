/**
 * The home screen, the "Jardin" tab (docs/specs/ui-lot1.md, section B): the screen, which shows a
 * model, the pure function that builds the model, and the hook that wires the two to the data.
 * Everything else in this folder is private.
 */

export {
  buildHomeModel,
  type HomeActions,
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
} from './use-home-model';
export { deviceLocalDate, useToday, type Clock } from './use-today';
