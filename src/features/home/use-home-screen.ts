import { Share } from 'react-native';

import type { LocalDate } from '@/domain/shared/local-date';

import { useArrival, type Arrival } from './arrival';
import type { HomeModel } from './home-model';
import { useNeighbourGardens, useSelfInitial, type NeighbourGardens } from './neighbours';
import { useHomeModel, type HomeModelDependencies } from './use-home-model';

export interface HomeScreenData {
  readonly model: HomeModel;
  readonly today: LocalDate;
  readonly neighbours: NeighbourGardens;
  readonly avatarInitial: string | null;
  readonly arrival: Arrival | null;
  readonly retry: () => void;
  readonly dismissArrival: () => void;
  readonly share: (message: string) => void;
}

/** Opens the system's share sheet (activity-views.md); a share the person cancels is no error. */
function shareMessage(message: string): void {
  Share.share({ message }).catch((error: unknown) => {
    console.warn('The share sheet could not be opened.', error);
  });
}

/**
 * Everything the home screen shows, from the store, the social demonstration and the clock: the
 * route only adds where each button leads.
 */
export function useHomeScreen(dependencies: HomeModelDependencies = {}): HomeScreenData {
  const { model, today, retry } = useHomeModel(dependencies);
  const neighbours = useNeighbourGardens(today);
  const avatarInitial = useSelfInitial();
  const { arrival, dismiss } = useArrival(model.status === 'ready' ? model.garden : null);
  return {
    model,
    today,
    neighbours,
    avatarInitial,
    arrival,
    retry,
    dismissArrival: dismiss,
    share: shareMessage,
  };
}
